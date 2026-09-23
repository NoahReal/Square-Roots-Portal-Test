"""API for the Admin role: see what farms have posted, buy from it for a drop cycle, and mark farm orders paid."""

from datetime import datetime, time, timedelta

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.notifications import friendly_time, notify_person
from accounts.permissions import IsAdminRole
from drops.models import DropCycle
from .models import FarmOrder, FarmOrderLine, ProduceListing
from .serializers import FarmOrderSerializer, ProduceListingSerializer


def default_pickup(cycle):
    """Farm pickups are the morning before the drop, at 9 am."""
    return timezone.make_aware(datetime.combine(cycle.drop_date - timedelta(days=1), time(9)))


def tell_farm(order, subject, body):
    for person in order.farm.people.all():
        notify_person(person, subject, body)


class AllProduceView(APIView):
    """Lists the produce every farm has posted and still has, grouped by farm (Admins). Expired produce is left out."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        listings = (
            ProduceListing.objects.filter(is_active=True)
            .filter(Q(available_until__isnull=True) | Q(available_until__gte=timezone.localdate()))
            .select_related("farm")
            .order_by("farm__name", "produce")
        )
        farms = {}
        for listing in listings:
            farm = farms.setdefault(
                listing.farm_id,
                {"id": listing.farm_id, "name": listing.farm.name, "location": listing.farm.location, "listings": []},
            )
            farm["listings"].append(ProduceListingSerializer(listing).data)
        return Response(list(farms.values()))


class BuyProduceView(APIView):
    """Buys pounds from a farm's produce listing for a drop cycle, adding it to that farm's order (Admins).

    New orders are drafts: the farm doesn't see them until the team sends them after ordering closes.
    """

    permission_classes = [IsAdminRole]

    @transaction.atomic
    def post(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        if cycle.drop_date <= timezone.localdate():
            raise ValidationError({"detail": "This drop has already happened."})
        listing = get_object_or_404(ProduceListing.objects.select_for_update(), pk=request.data.get("listing"), is_active=True)
        try:
            pounds = int(request.data.get("pounds"))
        except (TypeError, ValueError):
            raise ValidationError({"pounds": "Enter a number of pounds."})
        if listing.available_until and listing.available_until < timezone.localdate():
            until = listing.available_until
            raise ValidationError({"detail": f"{listing.produce} was only available until {until:%B} {until.day}."})
        if not 1 <= pounds <= listing.pounds:
            raise ValidationError({"pounds": f"Enter between 1 and {listing.pounds} lbs."})

        order, created = FarmOrder.objects.get_or_create(
            farm=listing.farm,
            drop_cycle=cycle,
            defaults={"pickup_at": default_pickup(cycle), "pickup_notes": listing.farm.pickup_notes},
        )
        if order.sent_at and order.status != FarmOrder.Status.WAITING:
            # The farm already had this order, and it changed, so they need to look at it again.
            order.status = FarmOrder.Status.WAITING
            order.farm_note = ""
            order.responded_at = None
            order.save()

        line, line_created = FarmOrderLine.objects.get_or_create(
            order=order, listing=listing,
            defaults={"produce": listing.produce, "pounds": pounds, "price_per_pound": listing.price_per_pound},
        )
        if not line_created:
            line.pounds += pounds
            line.save()

        listing.pounds -= pounds
        if listing.pounds == 0:
            listing.is_active = False
        listing.save()

        if order.sent_at:
            tell_farm(order, f"Your order for the {cycle.name} changed", "Square Roots added to your order. Please check and confirm it on your Pickups screen.")
        return Response({**FarmOrderSerializer(order).data, "farm_name": order.farm.name}, status=201)


class RemoveOrderLineView(APIView):
    """Removes an item from a farm order before pickup, giving the pounds back to the farm's listing (Admins)."""

    permission_classes = [IsAdminRole]

    @transaction.atomic
    def delete(self, request, pk):
        line = get_object_or_404(FarmOrderLine.objects.select_related("order", "listing"), pk=pk)
        order = line.order
        if order.pickup_at <= timezone.now():
            raise ValidationError({"detail": "This order has already been picked up."})
        if line.listing:
            line.listing.pounds += line.pounds
            line.listing.is_active = True
            line.listing.save()
        line.delete()
        if not order.lines.exists():
            order.delete()
        return Response(status=204)


class MarkPaidView(APIView):
    """Records that Square Roots has paid a farm for an order (Admins). Payments themselves happen outside the portal."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        order = get_object_or_404(FarmOrder, pk=pk)
        if order.status != FarmOrder.Status.CONFIRMED:
            raise ValidationError({"detail": "Only orders the farm confirmed can be paid."})
        order.payment = FarmOrder.Payment.PAID
        order.save()
        return Response({**FarmOrderSerializer(order).data, "farm_name": order.farm.name})


class FarmOrderDetailView(APIView):
    """Changes when and how a farm order is picked up. The farm is emailed about the change (Admins)."""

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        order = get_object_or_404(FarmOrder.objects.select_related("farm", "drop_cycle"), pk=pk)
        if order.pickup_at <= timezone.now():
            raise ValidationError({"detail": "This order has already been picked up."})
        if "pickup_at" in request.data:
            try:
                order.pickup_at = serializers.DateTimeField().to_internal_value(request.data["pickup_at"])
            except serializers.ValidationError:
                raise ValidationError({"pickup_at": "Choose a pickup day and time."})
            if order.pickup_at <= timezone.now():
                raise ValidationError({"pickup_at": "Choose a time that hasn't passed yet."})
        if "pickup_notes" in request.data:
            order.pickup_notes = (request.data["pickup_notes"] or "").strip()[:300]
        order.save()
        tell_farm(
            order, f"Pickup changed for the {order.drop_cycle.name}", f"New pickup time: {friendly_time(order.pickup_at)}.\n{order.pickup_notes}"
        )
        return Response({**FarmOrderSerializer(order).data, "farm_name": order.farm.name})


class SendToFarmsView(APIView):
    """Sends a drop cycle's draft orders to their farms in one batch, usually once ordering has closed (Admins)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        drafts = FarmOrder.objects.filter(drop_cycle=cycle, sent_at__isnull=True).select_related("farm").prefetch_related("lines")
        if not drafts:
            raise ValidationError({"detail": "There are no unsent farm orders for this drop."})
        now = timezone.now()
        for order in drafts:
            order.sent_at = now
            order.save(update_fields=["sent_at"])
            pounds = sum(line.pounds for line in order.lines.all())
            items = "\n".join(f"  - {line.pounds} lbs {line.produce} at ${line.price_per_pound}/lb" for line in order.lines.all())
            tell_farm(
                order,
                f"Square Roots order for the {cycle.name}",
                f"Here's our order for the {cycle.name} ({pounds} lbs, ${order.total:.2f}):\n{items}\n\n"
                f"Pickup: {friendly_time(order.pickup_at)}. {order.pickup_notes}\n\n"
                "Please confirm it on your Pickups screen in the partner portal.",
            )
        return Response({"detail": f"Sent {len(drafts)} {'order' if len(drafts) == 1 else 'orders'} to farms.", "sent": len(drafts)})
