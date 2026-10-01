"""API for customers reserving bundles on the website. No account needed: each reservation has a
private link for changing or cancelling it, and a pickup code to show at the drop."""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import (
    BUNDLE_POUNDS, DropCycle, Language, OperatingSettings, Preorder, PriceTier, Site, SiteDrop, StandingReservation, WaitlistEntry,
    new_manage_token,
)
from .reservations import (
    MAX_BUNDLES_PER_RESERVATION, already_reserved, amount_due, apply_standing, bundle_contents, bundle_for, bundles_left,
    digits, farm_cost_per_bundle, order_form_bundle, pay_it_forward_this_year, promote_waitlist, reservable_drops, send_confirmation,
    send_waitlist_joined, waitlist_position,
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
                for d in reservable_drops(site)
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
                "money": money_json(prices),
                "sites": sites,
            }
        )


def money_json(prices):
    """Where a bundle's price goes, and what neighbours have given to cover free bundles this year."""
    farms = farm_cost_per_bundle()
    given = pay_it_forward_this_year()
    return {
        "standard": f"{prices.standard_price:.2f}",
        "to_square_roots": f"{prices.at_cost_price:.2f}",
        "to_manager": f"{prices.manager_share:.2f}",
        # Part of the Square Roots share, so it can't be more than that.
        "to_farms": f"{min(farms, prices.at_cost_price):.2f}" if farms else None,
        "pay_it_forward_this_year": f"{given:.2f}",
        # A free bundle costs Square Roots the at-cost price, so that's what a gift has to cover.
        "free_bundles_covered": int(given // prices.at_cost_price) if prices.at_cost_price else 0,
    }


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
    language = serializers.ChoiceField(choices=Language.choices, required=False)
    pay_it_forward = serializers.DecimalField(
        max_digits=6, decimal_places=2, min_value=Decimal("0"), max_value=Decimal("100"), required=False,
        error_messages={"invalid": "Enter an amount in dollars, like 5.", "max_value": "Thank you! Gifts online are up to $100."},
    )

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
    every_drop = serializers.BooleanField(default=False)
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


def check_delivery_offered(site_drop, data):
    if data.get("delivery") and not site_drop.site.delivery_partner:
        raise ValidationError({"delivery": f"{site_drop.site.name} doesn't offer home delivery."})


def customer_impact(email):
    """What this customer has picked up so far (matched by email), for "Your impact" on their page."""
    if not email:
        return None
    bundles = Preorder.objects.filter(email__iexact=email, picked_up=True).aggregate(total=Sum("bundles"))["total"] or 0
    return {"bundles": bundles, "pounds": bundles * BUNDLE_POUNDS} if bundles else None


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
        "pay_it_forward": f"{reservation.pay_it_forward:.2f}",
        "every_drop": reservation.standing_id is not None,
        "language": reservation.language,
        "bundle": bundle_for(site_drop),
        "has_happened": site_drop.has_happened,
        "feedback": "" if waiting else reservation.feedback,
        "impact": customer_impact(reservation.email),
        "amount_due": f"{amount_due(reservation):.2f}",
        "delivery_fee": f"{OperatingSettings.current().delivery_fee:.2f}",
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
        every_drop = data.pop("every_drop")
        if data.pop("website", ""):
            raise ValidationError({"detail": "Something went wrong. Please try again."})
        if already_reserved(site_drop, data.get("email"), data.get("phone")):
            raise ValidationError(
                {"detail": "You already have a reservation for this drop. Use the link in your confirmation to change it."}
            )

        left = bundles_left(site_drop)
        if data["bundles"] > left and not join_waitlist:
            message = (
                "All the bundles for this drop have been reserved. You can join the waitlist."
                if left == 0
                else f"Only {left} {'bundle is' if left == 1 else 'bundles are'} left. Choose fewer, or join the waitlist."
            )
            return Response({"detail": message, "bundles_left": left, "full": True}, status=409)

        standing = StandingReservation.objects.create(site=site_drop.site, **data) if every_drop else None
        if data["bundles"] <= left:
            reservation = Preorder.objects.create(
                site_drop=site_drop, source=Preorder.Source.ONLINE, manage_token=new_manage_token(), standing=standing, **data
            )
            send_confirmation(reservation, site_url(request))
        else:
            reservation = WaitlistEntry.objects.create(site_drop=site_drop, standing=standing, **data)
            send_waitlist_joined(reservation, site_url(request))
        if standing:
            # Later drops that are already scheduled get a reservation too.
            for later in reservable_drops(site_drop.site):
                if later.pk != site_drop.pk:
                    apply_standing(later, site_url(request), only=standing)
        return Response(reservation_json(reservation), status=201)


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
        if reservation.standing:
            # Changes carry forward to the drops reserved automatically from now on.
            for field, value in data.items():
                setattr(reservation.standing, field, value)
            reservation.standing.save()

        if isinstance(reservation, Preorder):
            send_confirmation(reservation, site_url(request), kind="updated")
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


@method_decorator(csrf_protect, name="dispatch")
class EveryDropView(APIView):
    """Starts or stops reserving automatically at every drop at this reservation's location. Public, by private link."""

    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request, token):
        reservation = find_reservation(token)
        if reservation.standing is None:
            fields = [
                "customer_name", "phone", "email", "bundles", "price_tier", "pay_it_forward", "delivery", "delivery_address",
                "language",
            ]
            reservation.standing = StandingReservation.objects.create(
                site=reservation.site_drop.site, **{field: getattr(reservation, field) for field in fields}
            )
            reservation.save(update_fields=["standing"])
            for later in reservable_drops(reservation.site_drop.site):
                if later.pk != reservation.site_drop_id:
                    apply_standing(later, site_url(request), only=reservation.standing)
        return Response(reservation_json(reservation))

    @transaction.atomic
    def delete(self, request, token):
        reservation = find_reservation(token)
        if reservation.standing:
            # Reservations already made stay; no new ones will be made.
            reservation.standing.delete()
            reservation.refresh_from_db()
        return Response(reservation_json(reservation))


class BundleView(APIView):
    """What's in the bundles for the next drop whose farm orders are sent (or the latest one), with the farms. Public."""

    permission_classes = [AllowAny]

    def get(self, request):
        today = timezone.localdate()
        # Order forms first (routes that have switched over), then the older farm purchases.
        form_cycle = (
            DropCycle.objects.filter(order_forms__status="sent", drop_date__gte=today).order_by("drop_date").first()
            or DropCycle.objects.filter(order_forms__status="sent").order_by("-drop_date").first()
        )
        if form_cycle:
            items = order_form_bundle(form_cycle)
            if items:
                return Response({"drop_date": form_cycle.drop_date, "upcoming": form_cycle.drop_date >= today, "items": items})
        sent = DropCycle.objects.filter(farm_orders__sent_at__isnull=False).distinct()
        cycle = sent.filter(drop_date__gte=today).order_by("drop_date").first() or sent.order_by("-drop_date").first()
        if cycle is None:
            return Response({"drop_date": None, "upcoming": False, "items": []})
        return Response({"drop_date": cycle.drop_date, "upcoming": cycle.drop_date >= today, "items": bundle_contents(cycle)})


@method_decorator(csrf_protect, name="dispatch")
class FeedbackView(APIView):
    """ "How was your bundle?" after the drop: great, okay or not great, and an optional comment. Public, by private link."""

    permission_classes = [AllowAny]

    def post(self, request, token):
        reservation = find_reservation(token)
        if isinstance(reservation, WaitlistEntry) or not reservation.site_drop.has_happened:
            raise ValidationError({"detail": "You can tell us how it went after the drop."})
        feedback = request.data.get("feedback")
        if feedback not in Preorder.Feedback.values:
            raise ValidationError({"feedback": "Choose how your bundle was."})
        reservation.feedback = feedback
        reservation.feedback_comment = (request.data.get("comment") or "").strip()[:1000]
        reservation.save(update_fields=["feedback", "feedback_comment"])
        return Response(reservation_json(reservation))
