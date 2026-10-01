"""How customer reservations work: what's left, what's owed, the waitlist, and the emails customers get.

Each location sets aside a number of bundles for reservations at every drop (Site.reservation_limit).
Reservations made online and those the Community Manager adds both count towards it. When they're
gone, customers can join a waitlist; when someone cancels, the first person in line whose request
fits gets a reservation and an email.

Customers can also ask to "reserve every drop": each time a new drop is scheduled at their location,
apply_standing() reserves for them. And when the team moves or cancels a drop, notify_customers()
tells everyone who reserved.
"""

import re
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from farms.models import FarmOrder, FarmOrderLine
from . import customer_emails
from .models import BundleOrder, DropReport, OperatingSettings, Preorder, SiteDrop, WaitlistEntry, new_manage_token

# Most households take one or two bundles; this keeps one person from taking a whole drop's worth.
MAX_BUNDLES_PER_RESERVATION = 4


def reservable_drops(site):
    """The drops customers can still reserve for at a location: the next two whose ordering hasn't closed."""
    if not site.online_reservations:
        return []
    return list(SiteDrop.objects.filter(site=site, order_cutoff__gt=timezone.now()).select_related("site").order_by("drop_date")[:2])


def bundles_reserved(site_drop):
    return site_drop.preorders.aggregate(total=Sum("bundles"))["total"] or 0


def bundles_left(site_drop):
    return max(0, site_drop.site.reservation_limit - bundles_reserved(site_drop))


def price_for(tier, prices):
    return {"standard": prices.standard_price, "at_cost": prices.at_cost_price, "free": Decimal("0")}[tier]


def amount_due(reservation, prices=None):
    """What the customer pays at the drop: their bundles at the price they chose, any pay-it-forward gift,
    and delivery if they asked for it."""
    prices = prices or OperatingSettings.current()
    total = reservation.bundles * price_for(reservation.price_tier, prices) + reservation.pay_it_forward
    if reservation.delivery:
        total += prices.delivery_fee
    return total


def digits(text):
    return re.sub(r"\D", "", text or "")


def already_reserved(site_drop, email, phone, exclude=None):
    """Whether someone with this email or phone already has a reservation or waitlist spot at the drop."""
    for person in [*site_drop.preorders.all(), *site_drop.waitlist.all()]:
        if exclude is not None and type(person) is type(exclude) and person.pk == exclude.pk:
            continue
        if email and person.email.lower() == email.lower():
            return True
        if phone and digits(person.phone) and digits(person.phone)[-7:] == digits(phone)[-7:]:
            return True
    return False


def send_confirmation(preorder, site_url, kind="reserved"):
    """Emails the customer their reservation. `kind` picks the subject: reserved, updated, promoted or standing."""
    customer_emails.confirmation(preorder, site_url, amount_due(preorder), kind)


def send_waitlist_joined(entry, site_url):
    customer_emails.waitlist_joined(entry, site_url)


def promote_waitlist(site_drop, site_url):
    """Gives freed-up bundles to the people waiting, first come, first served. Returns the new reservations."""
    if not site_drop.ordering_open:
        return []
    promoted = []
    left = bundles_left(site_drop)
    for entry in site_drop.waitlist.all():
        if entry.bundles > left:
            continue
        preorder = Preorder.objects.create(
            site_drop=site_drop, customer_name=entry.customer_name, phone=entry.phone, email=entry.email,
            bundles=entry.bundles, price_tier=entry.price_tier, delivery=entry.delivery,
            delivery_address=entry.delivery_address, source=Preorder.Source.ONLINE,
            pay_it_forward=entry.pay_it_forward, standing=entry.standing, language=entry.language,
            # The same link keeps working: it now opens the reservation instead of the waitlist spot.
            manage_token=entry.manage_token,
        )
        entry.delete()
        left -= preorder.bundles
        send_confirmation(preorder, site_url, kind="promoted")
        promoted.append(preorder)
    return promoted


def waitlist_position(entry):
    return WaitlistEntry.objects.filter(site_drop=entry.site_drop, id__lt=entry.id).count() + 1


# ---------- Reserve every drop ----------


def apply_standing(site_drop, site_url, only=None):
    """Reserves for everyone who asked to reserve every drop at this location (or just `only`).

    Called when a drop is scheduled. If the drop is full, they go on its waitlist. Returns how many were added.
    """
    site = site_drop.site
    if not site.online_reservations or not site_drop.ordering_open:
        return 0
    added = 0
    for standing in [only] if only else site.standing_reservations.all():
        if already_reserved(site_drop, standing.email, standing.phone):
            continue
        details = {
            "customer_name": standing.customer_name, "phone": standing.phone, "email": standing.email,
            "bundles": standing.bundles, "price_tier": standing.price_tier, "pay_it_forward": standing.pay_it_forward,
            # Delivery only if the location still offers it.
            "delivery": standing.delivery and bool(site.delivery_partner),
            "delivery_address": standing.delivery_address if site.delivery_partner else "",
            "language": standing.language,
            "standing": standing,
        }
        if bundles_left(site_drop) >= standing.bundles:
            preorder = Preorder.objects.create(
                site_drop=site_drop, source=Preorder.Source.ONLINE, manage_token=new_manage_token(), **details
            )
            send_confirmation(preorder, site_url, kind="standing")
        else:
            entry = WaitlistEntry.objects.create(site_drop=site_drop, **details)
            send_waitlist_joined(entry, site_url)
        added += 1
    return added


# ---------- Telling customers about changes ----------


def notify_customers(site_drop, site_url, subject_key, message_key=None, message=None):
    """Emails everyone with a reservation or waitlist spot at a drop, each in their own language.

    Pass the key of a message in customer_emails.TEXT, or your own `message`. Returns how many
    were emailed, and the people who can only be reached by phone.
    """
    emailed, phone_only = 0, []
    for person in [*site_drop.preorders.all(), *site_drop.waitlist.all()]:
        if not person.email:
            phone_only.append({"customer_name": person.customer_name, "phone": person.phone})
            continue
        lang = person.language
        customer_emails.notice(
            person, site_url, subject_key, message_key, message,
            site=site_drop.site.name, details=customer_emails.drop_details(site_drop, lang),
            date=customer_emails.say_date(site_drop.drop_date, lang), reserve_link=f"{site_url.rstrip('/')}/reserve",
        )
        emailed += 1
    return emailed, phone_only


def tell_customers_drop_moved(site_drop, site_url):
    return notify_customers(site_drop, site_url, "moved_subject", "moved")


def tell_customers_drop_cancelled(site_drop, site_url):
    return notify_customers(site_drop, site_url, "cancelled_subject", "cancelled")


# ---------- Pay it forward, and where the money goes ----------


def pay_it_forward_this_year():
    """Money neighbours have given to help cover free bundles this year: donations logged after drops,
    plus pay-it-forward gifts on reservations for drops that haven't been logged yet."""
    year = timezone.localdate().year
    logged = DropReport.objects.filter(site_drop__drop_date__year=year).aggregate(total=Sum("donations"))["total"]
    pledged = Preorder.objects.filter(site_drop__drop_date__year=year, site_drop__report__isnull=True).aggregate(
        total=Sum("pay_it_forward")
    )["total"]
    return (logged or Decimal("0")) + (pledged or Decimal("0"))


def farm_cost_per_bundle():
    """What Square Roots has paid farms this year for each bundle sold, or None before there's any data."""
    year = timezone.localdate().year
    lines = FarmOrderLine.objects.filter(order__drop_cycle__drop_date__year=year).exclude(
        order__status=FarmOrder.Status.CANT_FILL
    )
    spent = sum((line.pounds * line.price_per_pound for line in lines), Decimal("0"))
    sold = DropReport.objects.filter(site_drop__drop_date__year=year).aggregate(total=Sum("bundles_sold"))["total"]
    if not sold or not spent:
        return None
    return spent / sold


# ---------- What's in the bundle ----------


def bundle_contents(cycle):
    """What's going into a drop's bundles, once the team has sent the farm orders.

    Each item comes with the farms growing it and roughly how many pounds of it go in each bundle.
    Returns [] until the orders are sent, since the plan can still change before then.
    """
    orders = (
        FarmOrder.objects.filter(drop_cycle=cycle, sent_at__isnull=False)
        .exclude(status=FarmOrder.Status.CANT_FILL)
        .select_related("farm")
        .prefetch_related("lines")
    )
    bundles = BundleOrder.objects.filter(site_drop__cycle=cycle).aggregate(total=Sum("bundles"))["total"] or 0
    items = {}
    for order in orders:
        for line in order.lines.all():
            item = items.setdefault(line.produce, {"produce": line.produce, "pounds": 0, "farms": {}})
            item["pounds"] += line.pounds
            item["farms"][order.farm.name] = order.farm.location
    result = []
    for item in sorted(items.values(), key=lambda i: -i["pounds"]):
        per_bundle = item["pounds"] / bundles if bundles else None
        result.append(
            {
                "produce": item["produce"],
                # Rounded to the nearest half pound: it's a guide, not a promise.
                "pounds_per_bundle": round(per_bundle * 2) / 2 if per_bundle else None,
                "farms": [{"name": name, "location": location} for name, location in sorted(item["farms"].items())],
            }
        )
    return result


def bundle_for(site_drop):
    """What's in the bundles at one location's drop. Locations whose route orders from order forms
    get their own order (once it's sent to suppliers); others get the cycle's farm purchases."""
    site = site_drop.site
    if site.route_id and site.route.uses_order_forms:
        from ordering.models import LocationOrderLine, OrderForm

        lines = LocationOrderLine.objects.filter(
            order__site=site, order__form__cycle=site_drop.cycle, order__form__status=OrderForm.Status.SENT, boxes__gt=0
        ).select_related("item__supplier")
        return [
            {
                "produce": line.item.product,
                # Bundles are made up from boxes by the location, so there's no exact weight per bundle.
                "pounds_per_bundle": None,
                "farms": [{"name": line.item.supplier.name, "location": line.item.supplier.location}],
            }
            for line in lines
        ]
    return bundle_contents(site_drop.cycle)


def order_form_bundle(cycle):
    """Everything ordered across locations on a cycle's sent order forms, for the public bundle page."""
    from ordering.models import LocationOrderLine, OrderForm

    items = {}
    for line in LocationOrderLine.objects.filter(
        order__form__cycle=cycle, order__form__status=OrderForm.Status.SENT, boxes__gt=0
    ).select_related("item__supplier"):
        item = items.setdefault(line.item.product, {"produce": line.item.product, "pounds_per_bundle": None, "farms": {}})
        item["farms"][line.item.supplier.name] = line.item.supplier.location
    return [
        {**item, "farms": [{"name": n, "location": l} for n, l in sorted(item["farms"].items())]}
        for item in sorted(items.values(), key=lambda i: i["produce"])
    ]
