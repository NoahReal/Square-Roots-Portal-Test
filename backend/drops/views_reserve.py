"""API for customers reserving bundles on the website. No account needed: each reservation has a
private link for changing or cancelling it, and a pickup code to show at the drop."""

import re

from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import OperatingSettings, Preorder, PriceTier, Site, SiteDrop, WaitlistEntry, new_manage_token
from .reservations import (
    MAX_BUNDLES_PER_RESERVATION, amount_due, bundles_left, promote_waitlist, reservable_drops,
    send_confirmation, send_waitlist_joined, waitlist_position,
)


def site_url(request):
    return f"{request.scheme}://{request.get_host()}"


def drop_json(site_drop):
    return {
        "id": site_drop.id,
        "drop_date": site_drop.drop_date,
        "starts_at": site_drop.starts_at,
        "ends_at": site_drop.ends_at,
        "order_cutoff": site_drop.order_cutoff,
    }


class ReserveOptionsView(APIView):
    """Locations, the drops you can reserve for, how many bundles are left, and prices. Public: used by the Reserve page."""

    permission_classes = [AllowAny]

    def get(self, request):
        prices = OperatingSettings.current()
        sites = []
        for site in Site.objects.filter(is_active=True):
            drops = [
                {**drop_json(d), "bundles_left": bundles_left(d), "waitlist_count": d.waitlist.count()}
                for d in reservable_drops(site).select_related("site")
            ]
            sites.append(
                {
                    "id": site.id,
                    "name": site.name,
                    "address": site.address,
                    "delivery_partner": site.delivery_partner,
                    "instagram_url": site.instagram_url,
                    "facebook_url": site.facebook_url,
                    "online_reservations": site.online_reservations,
                    "drops": drops,
                }
            )
        return Response(
            {
                "prices": {
                    "standard": f"{prices.standard_price:.2f}",
                    "at_cost": f"{prices.at_cost_price:.2f}",
                    "delivery_fee": f"{prices.delivery_fee:.2f}",
                },
                "max_bundles": MAX_BUNDLES_PER_RESERVATION,
                "sites": sites,
            }
        )


class ReservationSerializer(serializers.Serializer):
    """The Reserve form. The same checks apply when a customer changes their reservation."""

    customer_name = serializers.CharField(
        max_length=100, error_messages={"blank": "Please add your name.", "required": "Please add your name."}
    )
    email = serializers.EmailField(
        required=False, allow_blank=True, error_messages={"invalid": "Check your email address, like name@example.com."}
    )
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    bundles = serializers.IntegerField(
        min_value=1, max_value=MAX_BUNDLES_PER_RESERVATION,
        error_messages={
            "invalid": "Choose how many bundles.",
            "min_value": "Choose at least 1 bundle.",
            "max_value": f"You can reserve up to {MAX_BUNDLES_PER_RESERVATION} bundles at a time.",
        },
    )
    price_tier = serializers.ChoiceField(
        choices=PriceTier.choices, error_messages={"invalid_choice": "Choose the price that works for you."}
    )
    delivery = serializers.BooleanField(default=False)
    delivery_address = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate_customer_name(self, value):
        return value.strip()

    def validate_phone(self, value):
        value = value.strip()
        if value and len(digits(value)) < 7:
            raise serializers.ValidationError("Check your phone number, like 902-555-0123.")
        return value

    def validate(self, data):
        current = self.instance
        email = data.get("email", getattr(current, "email", ""))
        phone = data.get("phone", getattr(current, "phone", ""))
        if not email and not phone:
            raise serializers.ValidationError({"email": "Add an email or a phone number, so we can reach you if plans change."})
        delivery = data.get("delivery", getattr(current, "delivery", False))
        address = data.get("delivery_address", getattr(current, "delivery_address", "")).strip()
        if delivery and not address:
            raise serializers.ValidationError({"delivery_address": "Add the address to deliver to."})
        data["delivery_address"] = address if delivery else ""
        return data


class NewReservationSerializer(ReservationSerializer):
    site_drop = serializers.PrimaryKeyRelatedField(
        queryset=SiteDrop.objects.select_related("site"),
        error_messages={"required": "Choose a location.", "does_not_exist": "Choose a location.", "null": "Choose a location."},
    )
    join_waitlist = serializers.BooleanField(default=False)
    # A hidden field real people never fill in; spam bots usually do.
    website = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        data = super().validate(data)
        site_drop = data["site_drop"]
        if not site_drop.site.online_reservations or not site_drop.site.is_active:
            raise ValidationError({"site_drop": f"{site_drop.site.name} doesn't take online reservations yet."})
        if not site_drop.ordering_open:
            raise ValidationError({"site_drop": "Reservations for this drop have closed. Choose the next one."})
        check_delivery_offered(site_drop, data)
        return data


def digits(text):
    return re.sub(r"\D", "", text or "")


def already_reserved(site_drop, email, phone, exclude=None):
    people = list(site_drop.preorders.all()) + list(site_drop.waitlist.all())
    for person in people:
        if exclude is not None and type(person) is type(exclude) and person.pk == exclude.pk:
            continue
        if email and person.email.lower() == email.lower():
            return True
        if phone and digits(person.phone) and digits(person.phone)[-7:] == digits(phone)[-7:]:
            return True
    return False


def check_delivery_offered(site_drop, data):
    if data.get("delivery") and not site_drop.site.delivery_partner:
        raise ValidationError({"delivery": f"{site_drop.site.name} doesn't offer home delivery."})


def reservation_json(reservation):
    """A reservation or waitlist spot, as the customer sees it on their private page."""
    site_drop = reservation.site_drop
    site = site_drop.site
    waiting = isinstance(reservation, WaitlistEntry)
    return {
        "status": "waitlisted" if waiting else "reserved",
        "token": reservation.manage_token,
        "pickup_code": None if waiting else reservation.pickup_code,
        "waitlist_position": waitlist_position(reservation) if waiting else None,
        "customer_name": reservation.customer_name,
        "email": reservation.email,
        "phone": reservation.phone,
        "bundles": reservation.bundles,
        "price_tier": reservation.price_tier,
        "delivery": reservation.delivery,
        "delivery_address": reservation.delivery_address,
        "amount_due": f"{amount_due(reservation):.2f}",
        "picked_up": False if waiting else reservation.picked_up,
        # Until ordering closes, customers can change or cancel (and add bundles, if any are left).
        "can_change": site_drop.ordering_open and not getattr(reservation, "picked_up", False),
        "most_bundles": min(MAX_BUNDLES_PER_RESERVATION, reservation.bundles + (0 if waiting else bundles_left(site_drop))),
        "drop": drop_json(site_drop),
        "site": {
            "id": site.id,
            "name": site.name,
            "address": site.address,
            "delivery_partner": site.delivery_partner,
            "instagram_url": site.instagram_url,
            "facebook_url": site.facebook_url,
        },
    }


@method_decorator(csrf_protect, name="dispatch")
class ReserveView(APIView):
    """Reserves bundles at a drop, or joins its waitlist when they're all taken. Emails a confirmation. Public."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "reservations"

    @transaction.atomic
    def post(self, request):
        serializer = NewReservationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        site_drop = data.pop("site_drop")
        join_waitlist = data.pop("join_waitlist")
        if data.pop("website", ""):
            raise ValidationError({"detail": "Something went wrong. Please try again."})
        if already_reserved(site_drop, data.get("email"), data.get("phone")):
            raise ValidationError(
                {"detail": "You already have a reservation for this drop. Use the link in your confirmation to change it."}
            )

        left = bundles_left(site_drop)
        if data["bundles"] <= left:
            preorder = Preorder.objects.create(
                site_drop=site_drop, source=Preorder.Source.ONLINE, manage_token=new_manage_token(), **data
            )
            send_confirmation(preorder, site_url(request))
            return Response(reservation_json(preorder), status=201)
        if join_waitlist:
            entry = WaitlistEntry.objects.create(site_drop=site_drop, **data)
            send_waitlist_joined(entry, site_url(request))
            return Response(reservation_json(entry), status=201)
        message = (
            "All the bundles for this drop have been reserved. You can join the waitlist."
            if left == 0
            else f"Only {left} {'bundle is' if left == 1 else 'bundles are'} left. Choose fewer, or join the waitlist."
        )
        return Response({"detail": message, "bundles_left": left, "full": True}, status=409)


def find_reservation(token):
    reservation = (
        Preorder.objects.filter(manage_token=token).exclude(manage_token="").select_related("site_drop__site").first()
        or WaitlistEntry.objects.filter(manage_token=token).select_related("site_drop__site").first()
    )
    if reservation is None:
        raise NotFound("We couldn't find this reservation. It may have been cancelled.")
    return reservation


@method_decorator(csrf_protect, name="dispatch")
class ManageReservationView(APIView):
    """Shows, changes or cancels one reservation or waitlist spot, using the private link from its email. Public."""

    permission_classes = [AllowAny]

    def get(self, request, token):
        return Response(reservation_json(find_reservation(token)))

    def check_can_change(self, reservation):
        if not reservation.site_drop.ordering_open:
            raise ValidationError(
                {"detail": "Changes for this drop have closed. Please contact your Community Manager."}
            )
        if getattr(reservation, "picked_up", False):
            raise ValidationError({"detail": "This reservation has already been picked up."})

    @transaction.atomic
    def patch(self, request, token):
        reservation = find_reservation(token)
        self.check_can_change(reservation)
        serializer = ReservationSerializer(reservation, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        site_drop = reservation.site_drop
        check_delivery_offered(site_drop, data)
        if already_reserved(site_drop, data.get("email"), data.get("phone"), exclude=reservation):
            raise ValidationError({"detail": "Someone with this email or phone number already has a reservation for this drop."})

        was = reservation.bundles
        added = data.get("bundles", was) - was
        if isinstance(reservation, Preorder) and added > 0 and added > bundles_left(site_drop):
            left = bundles_left(site_drop)
            raise ValidationError({"bundles": f"Only {left} more {'bundle is' if left == 1 else 'bundles are'} left."})
        for field, value in data.items():
            setattr(reservation, field, value)
        reservation.save()

        if isinstance(reservation, Preorder):
            send_confirmation(reservation, site_url(request), subject="Your reservation was updated")
            if added < 0:
                promote_waitlist(site_drop, site_url(request))
        return Response(reservation_json(reservation))

    @transaction.atomic
    def delete(self, request, token):
        reservation = find_reservation(token)
        self.check_can_change(reservation)
        site_drop = reservation.site_drop
        reservation.delete()  # nothing about the customer is kept once they cancel
        if isinstance(reservation, Preorder):
            promote_waitlist(site_drop, site_url(request))
        return Response({"ok": True})
