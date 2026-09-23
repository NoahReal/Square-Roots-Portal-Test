from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.notifications import notify_team
from accounts.permissions import IsFarm
from .models import FarmOrder, ProduceListing
from .serializers import FarmOrderSerializer, ProduceListingSerializer


def farm_for(request):
    """The farm the logged-in user belongs to. Every farm view only ever shows that farm's data."""
    if request.user.farm is None:
        raise PermissionDenied("Your account isn't linked to a farm yet. Please contact the Square Roots team.")
    return request.user.farm


class ProduceListView(generics.ListCreateAPIView):
    """Lists the produce your farm has posted, or posts new produce (farms only)."""

    permission_classes = [IsFarm]
    serializer_class = ProduceListingSerializer

    def get_queryset(self):
        return ProduceListing.objects.filter(farm=farm_for(self.request), is_active=True)

    def perform_create(self, serializer):
        serializer.save(farm=farm_for(self.request))


class ProduceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Edits one of your farm's produce listings, or marks it sold out with DELETE (farms only)."""

    permission_classes = [IsFarm]
    serializer_class = ProduceListingSerializer

    def get_queryset(self):
        return ProduceListing.objects.filter(farm=farm_for(self.request), is_active=True)

    def perform_destroy(self, listing):
        # Keep the record for the team; just hide it from the farm's list.
        listing.is_active = False
        listing.save()


class FarmOrderListView(generics.ListAPIView):
    """Lists Square Roots' orders from your farm, with pickup times and payment status (farms only)."""

    permission_classes = [IsFarm]
    serializer_class = FarmOrderSerializer

    def get_queryset(self):
        return (
            FarmOrder.objects.filter(farm=farm_for(self.request))
            .select_related("drop_cycle")
            .prefetch_related("lines")
        )


class _RespondToOrderView(APIView):
    permission_classes = [IsFarm]
    new_status = None

    def post(self, request, pk):
        order = get_object_or_404(FarmOrder, pk=pk, farm=farm_for(request))
        if order.status != FarmOrder.Status.WAITING:
            raise ValidationError({"detail": "You've already answered this order."})
        order.status = self.new_status
        order.farm_note = (request.data.get("note") or "").strip()[:500]
        order.responded_at = timezone.now()
        order.save()
        notify_team(
            subject=f"{order.farm} {order.get_status_display().lower()}: {order.drop_cycle}",
            body=order.farm_note or "No note.",
        )
        return Response(FarmOrderSerializer(order).data)


class ConfirmOrderView(_RespondToOrderView):
    """Confirms your farm can fill an order (farms only)."""

    new_status = FarmOrder.Status.CONFIRMED


class CantFillOrderView(_RespondToOrderView):
    """Tells the team your farm can't fill an order, with an optional note (farms only)."""

    new_status = FarmOrder.Status.CANT_FILL
