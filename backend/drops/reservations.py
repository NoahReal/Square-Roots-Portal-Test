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

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Sum
from django.utils import timezone

from accounts.notifications import friendly_time
from farms.models import FarmOrder, FarmOrderLine
from .models import DropReport, OperatingSettings, Preorder, SiteDrop, WaitlistEntry, new_manage_token

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


def manage_link(token, site_url):
    return f"{site_url.rstrip('/')}/reserve/manage/{token}"


def friendly_date(day):
    return f"{day:%A, %B} {day.day}"


def friendly_clock(moment):
    hour = moment.hour % 12 or 12
    return f"{hour}:{moment.minute:02d} {'a.m.' if moment.hour < 12 else 'p.m.'}"


def drop_details(site_drop):
    site = site_drop.site
    return (
        f"When: {friendly_date(site_drop.drop_date)}, {friendly_clock(site_drop.starts_at)} to "
        f"{friendly_clock(site_drop.ends_at)}\n"
        f"Where: Square Roots {site.name}, {site.address}"
    )


def email_customer(reservation, subject, body):
    if reservation.email:
        send_mail(f"[Square Roots] {subject}", body, settings.DEFAULT_FROM_EMAIL, [reservation.email])


def send_confirmation(preorder, site_url, subject="Your bundle is reserved", intro=""):
    how = (
        f"We'll deliver to {preorder.delivery_address} with {preorder.site_drop.site.delivery_partner}."
        if preorder.delivery
        else f"Show this code when you pick up: {preorder.pickup_code}"
    )
    email_customer(
        preorder,
        subject,
        f"Hi {preorder.customer_name},\n\n"
        f"{intro}"
        f"You've reserved {plural(preorder.bundles, 'bundle')} of fresh Nova Scotia produce.\n\n"
        f"{drop_details(preorder.site_drop)}\n"
        f"To pay at the drop: ${amount_due(preorder):.2f}\n\n"
        f"{how}\n\n"
        f"Need to change or cancel? You can until {friendly_time(preorder.site_drop.order_cutoff)}:\n"
        f"{manage_link(preorder.manage_token, site_url)}\n\n"
        "See you there!\nSquare Roots",
    )


def send_waitlist_joined(entry, site_url):
    email_customer(
        entry,
        "You're on the waitlist",
        f"Hi {entry.customer_name},\n\n"
        f"All the bundles set aside at {entry.site_drop.site.name} have been reserved, so you're on the waitlist "
        f"for {plural(entry.bundles, 'bundle')}.\n\n"
        f"{drop_details(entry.site_drop)}\n\n"
        "If a spot opens up before ordering closes, we'll reserve it for you and email you right away.\n"
        f"To leave the waitlist: {manage_link(entry.manage_token, site_url)}\n\n"
        "Square Roots",
    )


def plural(count, word):
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


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
            pay_it_forward=entry.pay_it_forward, standing=entry.standing,
            # The same link keeps working: it now opens the reservation instead of the waitlist spot.
            manage_token=entry.manage_token,
        )
        entry.delete()
        left -= preorder.bundles
        send_confirmation(preorder, site_url, subject="Good news: a bundle opened up for you")
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
            "standing": standing,
        }
        if bundles_left(site_drop) >= standing.bundles:
            preorder = Preorder.objects.create(
                site_drop=site_drop, source=Preorder.Source.ONLINE, manage_token=new_manage_token(), **details
            )
            send_confirmation(
                preorder, site_url, subject="We've reserved your next bundle",
                intro="You asked us to reserve at every drop, so here's your next one. "
                "To stop, use the link at the bottom.\n\n",
            )
        else:
            entry = WaitlistEntry.objects.create(site_drop=site_drop, **details)
            send_waitlist_joined(entry, site_url)
        added += 1
    return added


# ---------- Telling customers about changes ----------


def notify_customers(site_drop, subject, message, site_url):
    """Emails everyone with a reservation or waitlist spot at a drop.

    Returns how many were emailed, and the people who can only be reached by phone.
    """
    emailed, phone_only = 0, []
    for person in [*site_drop.preorders.all(), *site_drop.waitlist.all()]:
        if not person.email:
            phone_only.append({"customer_name": person.customer_name, "phone": person.phone})
            continue
        link = f"Your reservation: {manage_link(person.manage_token, site_url)}\n\n" if person.manage_token else ""
        email_customer(person, subject, f"Hi {person.customer_name},\n\n{message}\n\n{link}Square Roots")
        emailed += 1
    return emailed, phone_only


def tell_customers_drop_moved(site_drop, site_url):
    return notify_customers(
        site_drop,
        f"Your Square Roots {site_drop.site.name} drop has changed",
        f"The {site_drop.site.name} drop you reserved for has a new date or time:\n\n{drop_details(site_drop)}\n\n"
        "Your reservation is still held. If the new time doesn't work, you can cancel it using the link below.",
        site_url,
    )


def tell_customers_drop_cancelled(site_drop, site_url):
    return notify_customers(
        site_drop,
        f"Your Square Roots {site_drop.site.name} drop is cancelled",
        f"We're sorry: the {site_drop.site.name} drop on {friendly_date(site_drop.drop_date)} is cancelled, "
        f"so your reservation is cancelled too. You won't be charged.\n\n"
        f"See the next drops and reserve again at {site_url.rstrip('/')}/reserve",
        site_url,
    )


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
