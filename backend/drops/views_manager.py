"""API for Community Managers: ordering bundles, preorders and after-drop reports for their own site."""

from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCommunityManager
from .models import BundleOrder, Preorder, SiteDrop
from .reservations import notify_customers, promote_waitlist
from .serializers import DropReportSerializer, PreorderSerializer, SiteDropSerializer

# Nobody orders more than this at once; it catches typos like 2000 instead of 20.
MAX_BUNDLES = 300


def site_for(request):
    """The location the logged-in Community Manager runs."""
    if request.user.site is None:
        raise PermissionDenied("Your account isn't linked to a location yet. Please contact the Square Roots team.")
    return request.user.site


def my_site_drop(request, pk):
    return get_object_or_404(SiteDrop, pk=pk, site=site_for(request))


def with_details(site_drops):
    return site_drops.select_related("cycle", "site", "order", "report").prefetch_related("preorders", "waitlist")


class ManagerDropListView(generics.ListAPIView):
    """Lists your site's upcoming drops and the last few past ones, with your order, preorders and report (Community Managers)."""

    permission_classes = [IsCommunityManager]
    serializer_class = SiteDropSerializer

    def get_queryset(self):
        # Upcoming drops, plus past drops from the last 10 weeks (for After Drop reports).
        since = timezone.localdate() - timedelta(weeks=10)
        return with_details(SiteDrop.objects.filter(site=site_for(self.request), drop_date__gte=since))


class OrderView(APIView):
    """Sets how many bundles you need for a drop. Only allowed before that drop's order cutoff (Community Managers)."""

    permission_classes = [IsCommunityManager]

    def put(self, request, pk):
        site_drop = my_site_drop(request, pk)
        if not site_drop.ordering_open:
            raise ValidationError({"detail": "Ordering for this drop has closed. Contact the Square Roots team if you need a change."})
        try:
            bundles = int(request.data.get("bundles"))
        except (TypeError, ValueError):
            raise ValidationError({"bundles": "Enter a number of bundles."})
        if not 0 <= bundles <= MAX_BUNDLES:
            raise ValidationError({"bundles": f"Enter a number from 0 to {MAX_BUNDLES}."})
        BundleOrder.objects.update_or_create(
            site_drop=site_drop, defaults={"bundles": bundles, "updated_by": request.user}
        )
        return Response(SiteDropSerializer(with_details(SiteDrop.objects.filter(pk=pk)).get()).data)


class PreorderListView(generics.ListCreateAPIView):
    """Lists or adds customer preorders for one of your drops (Community Managers)."""

    permission_classes = [IsCommunityManager]
    serializer_class = PreorderSerializer

    def get_queryset(self):
        return Preorder.objects.filter(site_drop=my_site_drop(self.request, self.kwargs["pk"]))

    def perform_create(self, serializer):
        site_drop = my_site_drop(self.request, self.kwargs["pk"])
        check_delivery_offered(site_drop, serializer.validated_data)
        serializer.save(site_drop=site_drop)


class PreorderDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Changes a preorder (e.g. mark it paid or picked up), or removes it (Community Managers)."""

    permission_classes = [IsCommunityManager]
    serializer_class = PreorderSerializer

    def get_queryset(self):
        return Preorder.objects.filter(site_drop__site=site_for(self.request))

    def perform_update(self, serializer):
        check_delivery_offered(serializer.instance.site_drop, serializer.validated_data)
        before = serializer.instance.bundles
        preorder = serializer.save()
        if preorder.bundles < before:
            promote_waitlist(preorder.site_drop, site_url(self.request))

    def perform_destroy(self, preorder):
        site_drop = preorder.site_drop
        preorder.delete()
        # Bundles freed up here go to the next person on the waitlist.
        promote_waitlist(site_drop, site_url(self.request))


def site_url(request):
    return f"{request.scheme}://{request.get_host()}"


class PickupCodeView(APIView):
    """Finds the reservation with a pickup code at one of your drops, so you can mark it paid and picked up (Community Managers)."""

    permission_classes = [IsCommunityManager]

    def get(self, request, pk, code):
        site_drop = my_site_drop(request, pk)
        code = code.strip().upper()
        preorder = site_drop.preorders.filter(pickup_code=code).first()
        if preorder is None:
            raise NotFound(f"No reservation has the code {code} at this drop. Check the letters, or search by name.")
        return Response(PreorderSerializer(preorder).data)


class ReservationSettingsView(APIView):
    """Turns online reservations on or off for your location, and sets how many bundles people can reserve per drop (Community Managers)."""

    permission_classes = [IsCommunityManager]

    def get(self, request):
        site = site_for(request)
        return Response({"online_reservations": site.online_reservations, "reservation_limit": site.reservation_limit})

    def patch(self, request):
        site = site_for(request)
        if "online_reservations" in request.data:
            site.online_reservations = bool(request.data["online_reservations"])
        if "reservation_limit" in request.data:
            try:
                limit = int(request.data["reservation_limit"])
            except (TypeError, ValueError):
                raise ValidationError({"reservation_limit": "Enter a number of bundles."})
            if not 0 <= limit <= MAX_BUNDLES:
                raise ValidationError({"reservation_limit": f"Enter a number from 0 to {MAX_BUNDLES}."})
            site.reservation_limit = limit
        site.save(update_fields=["online_reservations", "reservation_limit"])
        # More room may let people off the waitlist.
        for site_drop in SiteDrop.objects.filter(site=site, order_cutoff__gt=timezone.now()):
            promote_waitlist(site_drop, site_url(request))
        return self.get(request)


def check_delivery_offered(site_drop, data):
    if data.get("delivery") and not site_drop.site.delivery_partner:
        raise ValidationError({"delivery": f"{site_drop.site.name} doesn't offer home delivery."})


class DropReportView(APIView):
    """Saves how your drop went: bundles sold, left over, and where leftovers went. Only after the drop (Community Managers)."""

    permission_classes = [IsCommunityManager]

    def put(self, request, pk):
        site_drop = my_site_drop(request, pk)
        if not site_drop.has_happened:
            raise ValidationError({"detail": "You can log this drop once it has happened."})
        report = getattr(site_drop, "report", None)
        serializer = DropReportSerializer(report, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(site_drop=site_drop)
        return Response(SiteDropSerializer(with_details(SiteDrop.objects.filter(pk=pk)).get()).data)



class MessageCustomersView(APIView):
    """Emails everyone with a reservation or waitlist spot at one of your drops, e.g. about the weather.
    Says who has no email, so you can phone them (Community Managers)."""

    permission_classes = [IsCommunityManager]

    def post(self, request, pk):
        site_drop = my_site_drop(request, pk)
        message = (request.data.get("message") or "").strip()
        if not message:
            raise ValidationError({"message": "Write the message you'd like to send."})
        if len(message) > 2000:
            raise ValidationError({"message": "Please keep the message under 2,000 characters."})
        emailed, phone_only = notify_customers(
            site_drop, site_url(request), "message_subject",
            message=f"{message}\n\n{request.user.get_full_name() or 'Community Manager'}, Square Roots {site_drop.site.name}",
        )
        return Response({"emailed": emailed, "phone_only": phone_only})
