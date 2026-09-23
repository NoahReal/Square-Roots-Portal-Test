from datetime import timedelta

from django.db.models import Prefetch
from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsHostSite
from .models import DropCycle, OperatingSettings, Site, SiteDrop
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
