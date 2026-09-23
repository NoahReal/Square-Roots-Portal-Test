"""API for Community Managers: ordering bundles, preorders and after-drop reports for their own site."""

from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCommunityManager
from .models import BundleOrder, Preorder, SiteDrop
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
    return site_drops.select_related("cycle", "site", "order", "report").prefetch_related("preorders")


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
        serializer.save()


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

