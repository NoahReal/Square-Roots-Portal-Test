"""How customer reservations work: what's left, what's owed, the waitlist, and the emails customers get.

Each location sets aside a number of bundles for reservations at every drop (Site.reservation_limit).
Reservations made online and those the Community Manager adds both count towards it. When they're
gone, customers can join a waitlist; when someone cancels, the first person in line whose request
fits gets a reservation and an email.
"""

from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Sum
from django.utils import timezone

from accounts.notifications import friendly_time
from .models import OperatingSettings, Preorder, SiteDrop, WaitlistEntry

# Most households take one or two bundles; this keeps one person from taking a whole drop's worth.
MAX_BUNDLES_PER_RESERVATION = 4


def reservable_drops(site):
    """The drops customers can still reserve for at a location: the next two whose ordering hasn't closed."""
    if not site.online_reservations:
        return SiteDrop.objects.none()
    return SiteDrop.objects.filter(site=site, order_cutoff__gt=timezone.now()).order_by("drop_date")[:2]


def bundles_reserved(site_drop):
    return site_drop.preorders.aggregate(total=Sum("bundles"))["total"] or 0


def bundles_left(site_drop):
    return max(0, site_drop.site.reservation_limit - bundles_reserved(site_drop))


def price_for(tier, prices):
    return {"standard": prices.standard_price, "at_cost": prices.at_cost_price, "free": Decimal("0")}[tier]


def amount_due(reservation, prices=None):
    """What the customer pays at the drop: their bundles at the price they chose, plus delivery if they asked for it."""
    prices = prices or OperatingSettings.current()
    total = reservation.bundles * price_for(reservation.price_tier, prices)
    if reservation.delivery:
        total += prices.delivery_fee
    return total


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


def send_confirmation(preorder, site_url, subject="Your bundle is reserved"):
    how = (
        f"We'll deliver to {preorder.delivery_address} with {preorder.site_drop.site.delivery_partner}."
        if preorder.delivery
        else f"Show this code when you pick up: {preorder.pickup_code}"
    )
    email_customer(
        preorder,
        subject,
        f"Hi {preorder.customer_name},\n\n"
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
