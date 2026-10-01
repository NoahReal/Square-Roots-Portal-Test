"""The calculations behind ordering by the box, shared by every screen that needs them."""

from collections import defaultdict
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from drops.models import Site, SiteDrop
from farms.models import Farm
from .models import Confirmation, LocationOrderLine, OrderForm, PriceList
from .price_lists import changes, key


# ---------- Price lists ----------


def previous_price_list(price_list):
    """The same supplier's list for the cycle before this one, to compare prices with."""
    return (
        PriceList.objects.filter(supplier=price_list.supplier, cycle__drop_date__lt=price_list.cycle.drop_date)
        .order_by("-cycle__drop_date")
        .prefetch_related("items")
        .first()
    )


def price_list_json(price_list):
    previous = previous_price_list(price_list)
    now, gone = changes(list(price_list.items.all()), list(previous.items.all()) if previous else [])
    return {
        "id": price_list.id,
        "supplier": {"id": price_list.supplier_id, "name": price_list.supplier.name, "kind": price_list.supplier.kind},
        "cycle": {"id": price_list.cycle_id, "name": price_list.cycle.name},
        "received_on": price_list.received_on,
        "notes": price_list.notes,
        "compared_with": previous.cycle.name if previous else None,
        "items": [
            {
                "id": item.id, "product": item.product, "box_size": item.box_size, "price": f"{item.price:.2f}",
                "available": item.available, "notes": item.notes, "change": change,
                "old_price": f"{old:.2f}" if old is not None else None,
            }
            for item, change, old in now
        ],
        "gone": [{"product": item.product, "box_size": item.box_size, "price": f"{item.price:.2f}"} for item in gone],
    }


# ---------- Order forms ----------


def next_weekday(after, weekday):
    """The first date on or after `after` that falls on `weekday` (Monday is 0)."""
    return after + timedelta(days=(weekday - after.weekday()) % 7)


def suggested_dates(route, cycle):
    """When the trucks deliver and when orders are due, from the route's weekly days.

    Markets are usually the day after delivery, so delivery is the route's truck day just before the
    cycle's market date, and orders are due on the route's due day before that, at 5 p.m.
    """
    delivery = cycle.drop_date - timedelta(days=(cycle.drop_date.weekday() - route.trucks_on) % 7 or 7)
    due_day = delivery - timedelta(days=(delivery.weekday() - route.orders_due_on) % 7 or 7)
    return delivery, timezone.make_aware(datetime.combine(due_day, time(17)))


def form_sites(form):
    """The locations that order on this form: everyone on its routes."""
    return Site.objects.filter(route__in=form.routes.all(), is_active=True).select_related("drop_off", "route")


def lines_for(form):
    return LocationOrderLine.objects.filter(order__form=form, boxes__gt=0).select_related(
        "item__supplier", "order__site__drop_off", "order__site__route"
    )


def totals(lines):
    lines = list(lines)
    return {"boxes": sum(l.boxes for l in lines), "cost": f"{sum((l.cost for l in lines), Decimal('0')):.2f}"}


def item_json(item):
    return {
        "id": item.id, "supplier": item.supplier.name, "supplier_id": item.supplier_id, "product": item.product,
        "box_size": item.box_size, "price": f"{item.price:.2f}", "available": item.available,
        "deal": item.deal, "note": item.note,
    }


def last_time(site, form):
    """What this location ordered last time, by product, so the form can show it."""
    previous = (
        OrderForm.objects.filter(location_orders__site=site, delivery_date__lt=form.delivery_date)
        .order_by("-delivery_date")
        .first()
    )
    if previous is None:
        return {}
    lines = LocationOrderLine.objects.filter(order__form=previous, order__site=site).select_related("item")
    return {key(line.item.product): line.boxes for line in lines}


def sync_market_days(form):
    """Publishing a form sets each location's drop in the cycle: market the day after delivery, and
    customers can reserve until orders are due. This keeps reservations, reminders and After Drop in step."""
    market_day = form.delivery_date + timedelta(days=1)
    for site in form_sites(form):
        SiteDrop.objects.update_or_create(
            cycle=form.cycle, site=site, defaults={"drop_date": market_day, "order_cutoff": form.orders_due}
        )


# ---------- What goes where ----------


def supplier_order(form, supplier):
    """What one supplier needs to send.

    A wholesaler (like Ketty Brow's) only needs to know what goes to each drop-off point.
    A farm gets each location's detailed order.
    """
    lines = [l for l in lines_for(form) if l.item.supplier_id == supplier.id]
    groups = defaultdict(lambda: defaultdict(int))
    for line in lines:
        site = line.order.site
        where = (site.drop_off.name if site.drop_off else site.name) if supplier.kind == Farm.Kind.WHOLESALER else site.name
        groups[where][(line.item.product, line.item.box_size, line.item.price)] += line.boxes
    return {
        "supplier": supplier.name,
        "kind": supplier.kind,
        "grouped_by": "drop-off point" if supplier.kind == Farm.Kind.WHOLESALER else "location",
        "groups": [
            {
                "name": name,
                "items": [
                    {"product": p, "box_size": b, "boxes": n, "cost": f"{n * price:.2f}"}
                    for (p, b, price), n in sorted(items.items())
                ],
                "boxes": sum(items.values()),
            }
            for name, items in sorted(groups.items())
        ],
        **totals(lines),
    }


def transport_run(form, route):
    """A route's stops for the trucks: each drop-off point, its boxes and the locations it serves."""
    stops = defaultdict(lambda: {"boxes": 0, "sites": set(), "suppliers": defaultdict(int)})
    for line in lines_for(form):
        site = line.order.site
        if site.route_id != route.id:
            continue
        stop = stops[site.drop_off.name if site.drop_off else site.name]
        stop["boxes"] += line.boxes
        stop["sites"].add(site.name)
        stop["suppliers"][line.item.supplier.name] += line.boxes
    return {
        "route": route.name,
        "delivery_date": form.delivery_date,
        "stops": [
            {"name": name, "boxes": s["boxes"], "sites": sorted(s["sites"]), "from_suppliers": dict(s["suppliers"])}
            for name, s in sorted(stops.items())
        ],
        "boxes": sum(s["boxes"] for s in stops.values()),
    }


def hub_share(form, point):
    """What a hub earns on a form: its percent of what's bought from its supplier for the other
    locations it takes deliveries for. (Assumed: not its own order. To confirm with Square Roots.)"""
    if not point.hub_share_percent or not point.hub_share_supplier_id:
        return Decimal("0")
    bought = sum(
        (l.cost for l in lines_for(form)
         if l.order.site.drop_off_id == point.id and l.order.site_id != point.hub_site_id
         and l.item.supplier_id == point.hub_share_supplier_id),
        Decimal("0"),
    )
    return (bought * point.hub_share_percent / 100).quantize(Decimal("0.01"))


# ---------- Sending for confirmation ----------


def confirmation_link(confirmation, site_url):
    return f"{site_url.rstrip('/')}/confirm/{confirmation.token}"


def send_for_confirmation(form, site_url):
    """When ordering closes: one link per supplier with orders, and one per route's trucks.
    Emails whoever we have an address for; the screen shows the links to share any other way."""
    suppliers = Farm.objects.filter(id__in=lines_for(form).values("item__supplier")).distinct()
    made = []
    for supplier in suppliers:
        confirmation, _ = Confirmation.objects.get_or_create(form=form, kind=Confirmation.Kind.SUPPLIER, supplier=supplier)
        made.append(confirmation)
        emails = [supplier.contact_email] if supplier.contact_email else [u.email for u in supplier.people.all() if u.email]
        email(confirmation, emails, f"Square Roots order for delivery {say_date(form.delivery_date)}", site_url)
    for route in form.routes.all():
        confirmation, _ = Confirmation.objects.get_or_create(
            form=form, kind=Confirmation.Kind.TRANSPORT, route=route, defaults={"company": route.transport}
        )
        made.append(confirmation)
        if route.transport and route.transport.email:
            email(confirmation, [route.transport.email], f"Square Roots {route.name} run on {say_date(form.delivery_date)}", site_url)
    form.status = OrderForm.Status.SENT
    form.sent_at = timezone.now()
    form.save(update_fields=["status", "sent_at"])
    return made


def say_date(day):
    return f"{day:%A, %B} {day.day}"


def email(confirmation, addresses, subject, site_url):
    if not addresses:
        return
    send_mail(
        f"[Square Roots] {subject}",
        "Hello,\n\nHere's what Square Roots needs this time. Please open the link to see the details "
        f"and confirm whether you can do it:\n\n{confirmation_link(confirmation, site_url)}\n\n"
        "Thank you!\nThe Square Roots team",
        settings.DEFAULT_FROM_EMAIL,
        addresses,
    )
    confirmation.sent_at = timezone.now()
    confirmation.save(update_fields=["sent_at"])
