from datetime import timedelta

from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsHostSite
from .models import DropCycle, OperatingSettings, Preorder, PriceTier, Site, SiteDrop
from .reservations import MAX_BUNDLES_PER_RESERVATION, amount_due, bundles_left, promote_waitlist
from .serializers import SiteSerializer


class SiteListView(ListAPIView):
    """Lists every active Square Roots location with its next drop. Public: used by the Locations page and sign-up forms."""

    permission_classes = [AllowAny]
    serializer_class = SiteSerializer

    def get_queryset(self):
        upcoming = SiteDrop.objects.filter(drop_date__gte=timezone.localdate()).order_by("drop_date")
        return Site.objects.filter(is_active=True).prefetch_related(Prefetch("drops", queryset=upcoming))


class DropDatesView(APIView):
    """This year's drop dates. Public: shown on the Drop Dates & Locations page."""

    permission_classes = [AllowAny]

    def get(self, request):
        today = timezone.localdate()
        dates = DropCycle.objects.filter(drop_date__year=today.year).order_by("drop_date").values_list("drop_date", flat=True)
        # The next drop may be in the new year, so look past this year's list.
        upcoming = DropCycle.objects.filter(drop_date__gte=today).order_by("drop_date").first()
        return Response({"year": today.year, "dates": list(dates), "next": upcoming.drop_date if upcoming else None})


class HostDropListView(APIView):
    """Lists drops at your space: when they are, expected bundles, and who's running them (Host Sites)."""

    permission_classes = [IsHostSite]

    def get(self, request):
        site = request.user.site
        if site is None:
            return Response({"site": None, "drops": []})
        managers = [
            {"name": person.get_full_name(), "phone": person.phone, "email": person.email}
            for person in site.people.filter(role="community_manager", status="approved")
        ]
        drops = (
            SiteDrop.objects.filter(site=site, drop_date__gte=timezone.localdate() - timedelta(weeks=6))
            .select_related("cycle", "order")
        )
        return Response(
            {
                "site": {"name": site.name, "address": site.address},
                "managers": managers,
                "drops": [
                    {
                        "id": drop.id,
                        "cycle_name": drop.cycle.name,
                        "drop_date": drop.drop_date,
                        "starts_at": drop.starts_at,
                        "ends_at": drop.ends_at,
                        "bundles": drop.order.bundles if hasattr(drop, "order") else None,
                        "has_happened": drop.has_happened,
                    }
                    for drop in drops
                ],
            }
        )


class PricingView(APIView):
    """Bundle prices and where home delivery is offered. Public: shown on the website and portal screens."""

    permission_classes = [AllowAny]

    def get(self, request):
        settings = OperatingSettings.current()
        return Response(
            {
                "standard_price": f"{settings.standard_price:.2f}",
                "at_cost_price": f"{settings.at_cost_price:.2f}",
                "manager_share": f"{settings.manager_share:.2f}",
                "delivery_fee": f"{settings.delivery_fee:.2f}",
                "delivery": [
                    {"site": site.name, "partner": site.delivery_partner}
                    for site in Site.objects.filter(is_active=True).exclude(delivery_partner="")
                ],
            }
        )


# ---------- Host sites reserving on someone's behalf ----------


def host_row(preorder):
    return {
        "id": preorder.id,
        "customer_name": preorder.customer_name,
        "phone": preorder.phone,
        "bundles": preorder.bundles,
        "price_tier": preorder.price_tier,
        "price_tier_label": preorder.get_price_tier_display(),
        "pickup_code": preorder.pickup_code,
        "amount_due": f"{amount_due(preorder):.2f}",
        "picked_up": preorder.picked_up,
    }


class HostReserveSerializer(serializers.Serializer):
    site_drop = serializers.IntegerField(error_messages={"invalid": "Choose a drop."})
    customer_name = serializers.CharField(
        max_length=100, error_messages={"blank": "Add a first name or initials.", "required": "Add a first name or initials."}
    )
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    bundles = serializers.IntegerField(
        min_value=1, max_value=MAX_BUNDLES_PER_RESERVATION,
        error_messages={"max_value": f"Up to {MAX_BUNDLES_PER_RESERVATION} bundles per person.", "min_value": "At least 1 bundle."},
    )
    price_tier = serializers.ChoiceField(choices=PriceTier.choices, error_messages={"invalid_choice": "Choose a price."})


class HostReservationListView(APIView):
    """Your location's next drops and the bundles you've reserved for people you support, with their pickup codes.
    POST reserves for someone; no email or phone needed (Host Sites)."""

    permission_classes = [IsHostSite]

    def get(self, request):
        site = request.user.site
        if site is None:
            return Response({"site": None, "drops": []})
        drops = list(SiteDrop.objects.filter(site=site, drop_date__gte=timezone.localdate()).select_related("site")[:4])
        mine = Preorder.objects.filter(site_drop__in=[d.id for d in drops], source=Preorder.Source.HOST)
        return Response(
            {
                "site": {"name": site.name, "address": site.address},
                "drops": [
                    {
                        "id": d.id,
                        "drop_date": d.drop_date,
                        "starts_at": d.starts_at,
                        "ends_at": d.ends_at,
                        "order_cutoff": d.order_cutoff,
                        "ordering_open": d.ordering_open,
                        "bundles_left": bundles_left(d),
                        "reservations": [host_row(p) for p in mine if p.site_drop_id == d.id],
                    }
                    for d in drops
                ],
            }
        )

    @transaction.atomic
    def post(self, request):
        serializer = HostReserveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        site_drop = SiteDrop.objects.filter(pk=data.pop("site_drop"), site=request.user.site).select_related("site").first()
        if site_drop is None:
            raise ValidationError({"site_drop": "Choose one of your location's drops."})
        if not site_drop.ordering_open:
            raise ValidationError({"site_drop": "Reservations for this drop have closed. Choose the next one."})
        left = bundles_left(site_drop)
        if data["bundles"] > left:
            raise ValidationError(
                {"bundles": f"Only {left} {'bundle is' if left == 1 else 'bundles are'} left for this drop. "
                 "Please talk to your Community Manager."}
            )
        preorder = Preorder.objects.create(
            site_drop=site_drop, source=Preorder.Source.HOST, reserved_by=request.user,
            customer_name=data["customer_name"].strip(), phone=data.get("phone", "").strip(),
            bundles=data["bundles"], price_tier=data["price_tier"],
        )
        return Response(host_row(preorder), status=201)


class HostReservationDetailView(APIView):
    """Cancels a reservation you made for someone, before ordering closes (Host Sites)."""

    permission_classes = [IsHostSite]

    @transaction.atomic
    def delete(self, request, pk):
        preorder = get_object_or_404(
            Preorder.objects.select_related("site_drop__site"), pk=pk, source=Preorder.Source.HOST,
            site_drop__site=request.user.site,
        )
        if not preorder.site_drop.ordering_open:
            raise ValidationError({"detail": "Reservations for this drop have closed. Please talk to your Community Manager."})
        site_drop = preorder.site_drop
        preorder.delete()
        promote_waitlist(site_drop, f"{request.scheme}://{request.get_host()}")
        return Response({"ok": True})
