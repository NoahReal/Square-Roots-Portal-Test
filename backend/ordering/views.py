"""API for ordering by the box: price lists, order forms, location orders, confirmations and hubs."""

import csv
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.notifications import friendly_time, notify_person, notify_team
from accounts.permissions import IsAdminRole, IsCommunityManager, IsFarm
from drops.models import DropCycle, DropOffPoint, Route
from farms.models import Farm
from .logic import (
    form_sites, hub_share, item_json, last_time, lines_for, price_list_json, send_for_confirmation,
    suggested_dates, supplier_order, sync_market_days, totals, transport_run,
)
from .models import (
    Confirmation, LocationOrder, LocationOrderLine, OrderForm, OrderFormItem, PriceItem, PriceList, TransportCompany,
)
from .price_lists import key, read_rows

# Nobody orders more boxes of one item than this; it catches typos like 400 instead of 4.
MAX_BOXES = 200


def site_url(request):
    return f"{request.scheme}://{request.get_host()}"


def cycles_to_choose():
    """Cycles worth picking on the ordering screens: the next three and the last three."""
    today = timezone.localdate()
    upcoming = list(DropCycle.objects.filter(drop_date__gte=today).order_by("drop_date")[:3])
    past = list(DropCycle.objects.filter(drop_date__lt=today).order_by("-drop_date")[:3])
    now = timezone.now()
    return [
        {"id": c.id, "name": c.name, "drop_date": c.drop_date, "upcoming": c.drop_date >= today, "ordering_open": c.order_cutoff > now}
        for c in past[::-1] + upcoming
    ]


def suppliers_on_routes():
    return Farm.objects.filter(routes__isnull=False).distinct().order_by("name")


def save_price_list(supplier, cycle, text, notes=""):
    """Replaces a supplier's list for a cycle with the pasted rows. Nothing is saved if a row has a problem."""
    items, problems = read_rows(text)
    if problems:
        raise ValidationError({"text": problems})
    with transaction.atomic():
        price_list, _ = PriceList.objects.update_or_create(
            supplier=supplier, cycle=cycle, defaults={"received_on": timezone.localdate(), "notes": notes}
        )
        price_list.items.all().delete()
        PriceItem.objects.bulk_create(PriceItem(price_list=price_list, **item) for item in items)
    return price_list


# ---------- Admin: setup ----------


class OrderingSetupView(APIView):
    """Cycles to choose from, routes (and whether they use order forms) and transport companies (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(
            {
                "cycles": cycles_to_choose(),
                "routes": [
                    {
                        "id": r.id, "name": r.name, "uses_order_forms": r.uses_order_forms,
                        "transport": r.transport_id, "suppliers": [s.name for s in r.suppliers.all()],
                    }
                    for r in Route.objects.prefetch_related("suppliers")
                ],
                "transport_companies": [
                    {"id": t.id, "name": t.name, "contact_name": t.contact_name, "email": t.email, "phone": t.phone}
                    for t in TransportCompany.objects.all()
                ],
            }
        )


class RouteSwitchView(APIView):
    """Switches a route to order forms (or back), and sets who drives it (Admins)."""

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        route = get_object_or_404(Route, pk=pk)
        if "uses_order_forms" in request.data:
            route.uses_order_forms = bool(request.data["uses_order_forms"])
        if "transport" in request.data:
            route.transport = TransportCompany.objects.filter(pk=request.data["transport"]).first()
        route.save(update_fields=["uses_order_forms", "transport"])
        return OrderingSetupView().get(request)


class TransportCompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = TransportCompany
        fields = ["id", "name", "contact_name", "email", "phone"]
        extra_kwargs = {"name": {"error_messages": {"blank": "Add the company's name."}}}


class TransportCompanyView(APIView):
    """Adds a transport company (Admins)."""

    permission_classes = [IsAdminRole]

    def post(self, request):
        serializer = TransportCompanySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


# ---------- Admin: price lists ----------


class PriceListView(APIView):
    """Every supplier's price list for a cycle (?cycle=ID), with what changed since their last list.
    POST adds or replaces a supplier's list from pasted spreadsheet rows or CSV text (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        cycle = get_object_or_404(DropCycle, pk=request.query_params.get("cycle"))
        lists = {
            pl.supplier_id: pl
            for pl in PriceList.objects.filter(cycle=cycle).select_related("supplier", "cycle").prefetch_related("items")
        }
        return Response(
            {
                "cycle": {"id": cycle.id, "name": cycle.name},
                "suppliers": [
                    {
                        "id": s.id, "name": s.name, "kind": s.get_kind_display(),
                        "price_list": price_list_json(lists[s.id]) if s.id in lists else None,
                    }
                    for s in suppliers_on_routes()
                ],
            }
        )

    def post(self, request):
        supplier = get_object_or_404(Farm, pk=request.data.get("supplier"))
        cycle = get_object_or_404(DropCycle, pk=request.data.get("cycle"))
        price_list = save_price_list(supplier, cycle, request.data.get("text"), request.data.get("notes", ""))
        return Response(price_list_json(price_list), status=201)


class PriceItemView(APIView):
    """Fixes one line of a price list (price, boxes available), or removes it (Admins)."""

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        item = get_object_or_404(PriceItem, pk=pk)
        if "price" in request.data:
            item.price = parse_price(request.data["price"])
        if "available" in request.data:
            value = request.data["available"]
            item.available = int(value) if str(value).strip() else None
        item.save()
        return Response(price_list_json(item.price_list))

    def delete(self, request, pk):
        item = get_object_or_404(PriceItem, pk=pk)
        price_list = item.price_list
        item.delete()
        return Response(price_list_json(price_list))


def parse_price(value):
    try:
        price = Decimal(str(value).replace("$", "").strip()).quantize(Decimal("0.01"))
    except InvalidOperation:
        raise ValidationError({"price": "Enter a price like 22.50."})
    if price < 0:
        raise ValidationError({"price": "A price can't be below $0."})
    return price


# ---------- Admin: order forms ----------


def form_summary(form):
    sites = list(form_sites(form))
    ordered = set(form.location_orders.filter(lines__boxes__gt=0).values_list("site_id", flat=True))
    return {
        "id": form.id,
        "cycle": {"id": form.cycle_id, "name": form.cycle.name},
        "routes": [{"id": r.id, "name": r.name} for r in form.routes.all()],
        "delivery_date": form.delivery_date,
        "market_date": form.delivery_date + timedelta(days=1),
        "orders_due": form.orders_due,
        "status": form.status,
        "status_label": form.get_status_display(),
        "ordering_open": form.ordering_open,
        "sent_at": form.sent_at,
        "locations": len(sites),
        "locations_ordered": len([s for s in sites if s.id in ordered]),
        **totals(lines_for(form)),
    }


def form_detail(form):
    lines = list(lines_for(form))
    sites = list(form_sites(form))
    by_site = {}
    for line in lines:
        by_site.setdefault(line.order.site_id, []).append(line)
    route_suppliers = Farm.objects.filter(routes__in=form.routes.all()).distinct()
    on_form = {i.price_item_id for i in form.items.all() if i.price_item_id}
    price_items = PriceItem.objects.filter(
        price_list__cycle=form.cycle, price_list__supplier__in=route_suppliers
    ).select_related("price_list__supplier")
    hubs = DropOffPoint.objects.filter(route__in=form.routes.all(), hub_site__isnull=False).select_related(
        "hub_site", "hub_share_supplier"
    )
    confirmations = {(c.kind, c.supplier_id or c.route_id): c for c in form.confirmations.all()}
    suppliers_used = Farm.objects.filter(id__in={l.item.supplier_id for l in lines}).order_by("name")
    return {
        **form_summary(form),
        "notes": form.notes,
        "items": [item_json(i) for i in form.items.select_related("supplier")],
        "price_items": [
            {
                "id": p.id, "supplier": p.price_list.supplier.name, "product": p.product, "box_size": p.box_size,
                "price": f"{p.price:.2f}", "available": p.available, "on_form": p.id in on_form,
            }
            for p in price_items
        ],
        "location_orders": [
            {
                "site": s.name, "site_id": s.id, "route": s.route.name if s.route else None,
                "drop_off": s.drop_off.name if s.drop_off else None,
                "ordered": s.id in by_site, **totals(by_site.get(s.id, [])),
                "lines": [{"product": l.item.product, "supplier": l.item.supplier.name, "boxes": l.boxes} for l in by_site.get(s.id, [])],
            }
            for s in sites
        ],
        "supplier_orders": [
            {**supplier_order(form, s), "confirmation": confirmation_json(confirmations.get(("supplier", s.id)))}
            for s in suppliers_used
        ],
        "transport_runs": [
            {**transport_run(form, r), "company": r.transport.name if r.transport else None,
             "confirmation": confirmation_json(confirmations.get(("transport", r.id)))}
            for r in form.routes.select_related("transport")
        ],
        "hubs": [
            {"name": h.name, "hub_site": h.hub_site.name, "percent": f"{h.hub_share_percent.normalize():f}",
             "supplier": h.hub_share_supplier.name if h.hub_share_supplier else None, "share": f"{hub_share(form, h):.2f}"}
            for h in hubs
        ],
    }


def confirmation_json(confirmation):
    if confirmation is None:
        return None
    return {
        "status": confirmation.status, "status_label": confirmation.get_status_display(), "reply": confirmation.reply,
        "token": confirmation.token, "sent_at": confirmation.sent_at, "replied_at": confirmation.replied_at,
    }


def editable(form):
    if form.status == OrderForm.Status.SENT:
        raise ValidationError({"detail": "This form has been sent to suppliers, so it can't change."})


class OrderFormListView(APIView):
    """Lists order forms, newest first, or starts a new one for a cycle and routes (Admins).

    A new form can start from the routes' last form: its items come across with this cycle's prices.
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        forms = OrderForm.objects.select_related("cycle").prefetch_related("routes")[:20]
        return Response([form_summary(f) for f in forms])

    @transaction.atomic
    def post(self, request):
        cycle = get_object_or_404(DropCycle, pk=request.data.get("cycle"))
        routes = list(Route.objects.filter(pk__in=request.data.get("routes") or []))
        if not routes:
            raise ValidationError({"routes": "Choose at least one route."})
        taken = OrderForm.objects.filter(cycle=cycle, routes__in=routes).first()
        if taken:
            raise ValidationError({"routes": f"There's already a form for {', '.join(r.name for r in taken.routes.all())} this cycle."})
        delivery, due = suggested_dates(routes[0], cycle)
        form = OrderForm.objects.create(cycle=cycle, delivery_date=delivery, orders_due=due)
        form.routes.set(routes)
        if request.data.get("copy_last"):
            copy_last_form(form, routes)
        return Response(form_detail(form), status=201)


def copy_last_form(form, routes):
    """Brings across the items from these routes' last form, priced from this cycle's price lists.
    Items no supplier is offering this cycle are left out."""
    last = OrderForm.objects.filter(routes__in=routes, delivery_date__lt=form.delivery_date).order_by("-delivery_date").first()
    if last is None:
        return
    current = {
        (p.price_list.supplier_id, key(p.product)): p
        for p in PriceItem.objects.filter(price_list__cycle=form.cycle).select_related("price_list")
    }
    for item in last.items.all():
        price_item = current.get((item.supplier_id, key(item.product)))
        if price_item is None:
            continue
        OrderFormItem.objects.create(
            form=form, supplier=item.supplier, price_item=price_item, product=price_item.product,
            box_size=price_item.box_size, price=price_item.price, available=price_item.available,
            deal=item.deal if price_item.price <= item.price else OrderFormItem.Deal.PRICEY,
            note=item.note, sort_order=item.sort_order,
        )


class OrderFormDetailView(APIView):
    """One order form: its items, what's on the price lists, every location's order, what each supplier
    and truck gets, hub shares and confirmations. PATCH changes the dates or the note to locations (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        return Response(form_detail(get_object_or_404(OrderForm, pk=pk)))

    def patch(self, request, pk):
        form = get_object_or_404(OrderForm, pk=pk)
        editable(form)
        if "notes" in request.data:
            form.notes = request.data["notes"]
        if "delivery_date" in request.data:
            form.delivery_date = serializers.DateField().to_internal_value(request.data["delivery_date"])
        if "orders_due" in request.data:
            form.orders_due = serializers.DateTimeField().to_internal_value(request.data["orders_due"])
        if timezone.localtime(form.orders_due).date() >= form.delivery_date:
            raise ValidationError({"orders_due": "Orders should be due before the delivery day."})
        form.save()
        if form.status == OrderForm.Status.OPEN:
            sync_market_days(form)
        return Response(form_detail(form))

    def delete(self, request, pk):
        form = get_object_or_404(OrderForm, pk=pk)
        if form.status != OrderForm.Status.DRAFT:
            raise ValidationError({"detail": "Only a draft form can be deleted."})
        form.delete()
        return Response(status=204)


class OrderFormItemsView(APIView):
    """Adds an item to a form: from a price list ({price_item}), or typed in ({supplier, product, box_size, price}) (Admins)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        form = get_object_or_404(OrderForm, pk=pk)
        editable(form)
        last = form.items.order_by("-sort_order").first()
        order = (last.sort_order + 1) if last else 0
        if request.data.get("price_item"):
            p = get_object_or_404(PriceItem.objects.select_related("price_list"), pk=request.data["price_item"])
            if form.items.filter(price_item=p).exists():
                raise ValidationError({"detail": f"{p.product} is already on the form."})
            OrderFormItem.objects.create(
                form=form, supplier=p.price_list.supplier, price_item=p, product=p.product, box_size=p.box_size,
                price=p.price, available=p.available, sort_order=order,
            )
        else:
            supplier = get_object_or_404(Farm, pk=request.data.get("supplier"))
            product = (request.data.get("product") or "").strip()
            if not product:
                raise ValidationError({"product": "Add the product's name."})
            OrderFormItem.objects.create(
                form=form, supplier=supplier, product=product[:120], box_size=(request.data.get("box_size") or "")[:60],
                price=parse_price(request.data.get("price")), sort_order=order,
            )
        return Response(form_detail(form), status=201)


class OrderFormItemView(APIView):
    """Marks an item as a good deal or pricier than usual, adds a note, or removes it (Admins)."""

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        item = get_object_or_404(OrderFormItem, pk=pk)
        editable(item.form)
        if "deal" in request.data:
            if request.data["deal"] not in OrderFormItem.Deal.values:
                raise ValidationError({"deal": "Choose good deal, pricier than usual, or nothing."})
            item.deal = request.data["deal"]
        if "note" in request.data:
            item.note = (request.data["note"] or "")[:200]
        item.save()
        return Response(form_detail(item.form))

    def delete(self, request, pk):
        item = get_object_or_404(OrderFormItem, pk=pk)
        editable(item.form)
        if item.lines.filter(boxes__gt=0).exists():
            raise ValidationError({"detail": f"Locations have already ordered {item.product}, so it can't be removed."})
        form = item.form
        item.delete()
        return Response(form_detail(form))


class PublishFormView(APIView):
    """Opens a form for orders: sets each location's market day in the cycle, and emails each
    location's Community Managers the link (Admins)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        form = get_object_or_404(OrderForm, pk=pk)
        if form.status != OrderForm.Status.DRAFT:
            raise ValidationError({"detail": "This form is already open."})
        if not form.items.exists():
            raise ValidationError({"detail": "Add at least one item before opening the form."})
        if form.orders_due <= timezone.now():
            raise ValidationError({"orders_due": "The due date has passed. Change it before opening the form."})
        form.status = OrderForm.Status.OPEN
        form.published_at = timezone.now()
        form.save(update_fields=["status", "published_at"])
        sync_market_days(form)
        link = f"{site_url(request)}/portal/manager/order"
        for manager in User.objects.filter(
            role=User.Role.COMMUNITY_MANAGER, status=User.Status.APPROVED, site__in=form_sites(form)
        ):
            notify_person(
                manager,
                f"This week's order form is open (due {friendly_time(form.orders_due)})",
                f"Hi {manager.first_name},\n\nThe order form for {manager.site.name} is ready. "
                f"Trucks deliver {form.delivery_date:%A, %B} {form.delivery_date.day}.\n\n"
                + (f"{form.notes}\n\n" if form.notes else "")
                + f"Order here by {friendly_time(form.orders_due)}:\n{link}",
            )
        return Response(form_detail(form))


class SendFormView(APIView):
    """Closes ordering (if it's still open) and sends each supplier and route's trucks a link to confirm (Admins)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        form = get_object_or_404(OrderForm, pk=pk)
        if form.status == OrderForm.Status.DRAFT:
            raise ValidationError({"detail": "Open the form for orders first."})
        if not lines_for(form).exists():
            raise ValidationError({"detail": "Nobody has ordered anything on this form yet."})
        if form.ordering_open:
            # Closing early: ordering stops now.
            form.orders_due = timezone.now()
            form.save(update_fields=["orders_due"])
        send_for_confirmation(form, site_url(request))
        return Response(form_detail(form))


class OrderFormCsvView(APIView):
    """Every location's order on a form as a CSV file, to open in Excel or keep in Google Drive or SharePoint (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        form = get_object_or_404(OrderForm, pk=pk)
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="order-form-{form.delivery_date}.csv"'
        writer = csv.writer(response)
        writer.writerow(["Location", "Route", "Drop-off point", "Supplier", "Product", "Box size", "Price per box", "Boxes", "Cost"])
        for line in sorted(lines_for(form), key=lambda l: (l.order.site.name, l.item.sort_order)):
            site = line.order.site
            writer.writerow([
                site.name, site.route.name if site.route else "", site.drop_off.name if site.drop_off else "",
                line.item.supplier.name, line.item.product, line.item.box_size, f"{line.item.price:.2f}",
                line.boxes, f"{line.cost:.2f}",
            ])
        return response


# ---------- Community Managers: ordering ----------


def my_site(request):
    if request.user.site is None:
        raise PermissionDenied("Your account isn't linked to a location yet. Please contact the Square Roots team.")
    return request.user.site


def manager_form_json(form, site):
    order = form.location_orders.filter(site=site).prefetch_related("lines").first()
    mine = {line.item_id: line.boxes for line in order.lines.all()} if order else {}
    before = last_time(site, form)
    items = []
    for item in form.items.select_related("supplier"):
        boxes = mine.get(item.id, 0)
        items.append({**item_json(item), "boxes": boxes, "last_time": before.get(key(item.product))})
    lines = [l for l in order.lines.select_related("item")] if order else []
    return {
        **{k: v for k, v in form_summary(form).items() if k not in ("locations", "locations_ordered", "boxes", "cost")},
        "notes": form.notes,
        "items": items,
        "my_order": {**totals(l for l in lines if l.boxes), "updated_at": order.updated_at if order else None},
    }


class ManagerOrderFormsView(APIView):
    """The order forms for your location's route: open ones to fill in, and recent ones (Community Managers)."""

    permission_classes = [IsCommunityManager]

    def get(self, request):
        site = my_site(request)
        forms = OrderForm.objects.filter(routes=site.route).exclude(status=OrderForm.Status.DRAFT).order_by("-delivery_date")[:4]
        return Response(
            {"uses_order_forms": bool(site.route and site.route.uses_order_forms), "forms": [manager_form_json(f, site) for f in forms]}
        )


class ManagerOrderView(APIView):
    """Saves your order on a form: {"lines": {item id: boxes}}. Only while the form is open (Community Managers)."""

    permission_classes = [IsCommunityManager]

    @transaction.atomic
    def put(self, request, pk):
        site = my_site(request)
        form = get_object_or_404(OrderForm, pk=pk, routes=site.route)
        if not form.ordering_open:
            raise ValidationError({"detail": "Ordering for this form has closed. Contact the Square Roots team if you need a change."})
        items = {item.id: item for item in form.items.all()}
        wanted = {}
        for item_id, boxes in (request.data.get("lines") or {}).items():
            item = items.get(int(item_id))
            if item is None:
                raise ValidationError({"detail": "Something on your order isn't on this form any more. Reload the page."})
            try:
                boxes = int(boxes)
            except (TypeError, ValueError):
                raise ValidationError({"detail": f"Enter a number of boxes for {item.product}."})
            if not 0 <= boxes <= MAX_BOXES:
                raise ValidationError({"detail": f"Enter 0 to {MAX_BOXES} boxes for {item.product}."})
            wanted[item.id] = boxes
        order, _ = LocationOrder.objects.get_or_create(form=form, site=site)
        order.updated_by = request.user
        order.save()
        for item_id, boxes in wanted.items():
            LocationOrderLine.objects.update_or_create(order=order, item_id=item_id, defaults={"boxes": boxes})
        return Response(manager_form_json(form, site))


class HubView(APIView):
    """For a location that runs a hub (like Fairview): what's arriving for each location it takes
    deliveries for, on recent and upcoming forms, and the hub's share (Community Managers)."""

    permission_classes = [IsCommunityManager]

    def get(self, request):
        site = my_site(request)
        hubs = list(DropOffPoint.objects.filter(hub_site=site).select_related("hub_share_supplier", "route"))
        if not hubs:
            return Response({"hubs": []})
        result = []
        for hub in hubs:
            forms = OrderForm.objects.filter(routes=hub.route).exclude(status=OrderForm.Status.DRAFT).order_by("-delivery_date")[:3]
            result.append(
                {
                    "name": hub.name,
                    "percent": f"{hub.hub_share_percent.normalize():f}",
                    "supplier": hub.hub_share_supplier.name if hub.hub_share_supplier else None,
                    "forms": [hub_form_json(form, hub) for form in forms],
                }
            )
        return Response({"hubs": result})


def hub_form_json(form, hub):
    by_site = {}
    for line in lines_for(form):
        if line.order.site.drop_off_id == hub.id:
            by_site.setdefault(line.order.site.name, []).append(
                {"product": line.item.product, "box_size": line.item.box_size, "supplier": line.item.supplier.name, "boxes": line.boxes}
            )
    return {
        "id": form.id,
        "delivery_date": form.delivery_date,
        "status_label": form.get_status_display(),
        "ordering_open": form.ordering_open,
        "locations": [
            {"name": name, "boxes": sum(i["boxes"] for i in items), "items": items} for name, items in sorted(by_site.items())
        ],
        "boxes": sum(sum(i["boxes"] for i in items) for items in by_site.values()),
        "share": f"{hub_share(form, hub):.2f}",
    }


# ---------- Suppliers: their own price lists ----------


class SupplierPriceListView(APIView):
    """Your price lists for the next cycles, with what changed. POST sends one: paste rows from your
    spreadsheet or a CSV, for a cycle (Farms and other suppliers)."""

    permission_classes = [IsFarm]

    def supplier(self, request):
        if request.user.farm is None:
            raise PermissionDenied("Your account isn't linked to a farm yet. Please contact the Square Roots team.")
        return request.user.farm

    def get(self, request):
        supplier = self.supplier(request)
        cycles = [c for c in cycles_to_choose() if c["upcoming"]]
        lists = {pl.cycle_id: pl for pl in PriceList.objects.filter(supplier=supplier, cycle_id__in=[c["id"] for c in cycles])}
        return Response(
            {"cycles": [{**c, "price_list": price_list_json(lists[c["id"]]) if c["id"] in lists else None} for c in cycles]}
        )

    def post(self, request):
        supplier = self.supplier(request)
        cycle = get_object_or_404(DropCycle, pk=request.data.get("cycle"))
        price_list = save_price_list(supplier, cycle, request.data.get("text"), request.data.get("notes", ""))
        notify_team(
            f"{supplier.name} sent their price list for the {cycle.name}",
            "It's on the Price Lists screen in the partner portal, with what changed since last time.",
        )
        return Response(price_list_json(price_list), status=201)


# ---------- Confirmation links (no login: suppliers and transport companies) ----------


def public_confirmation_json(confirmation):
    form = confirmation.form
    data = {
        "kind": confirmation.kind,
        "delivery_date": form.delivery_date,
        "status": confirmation.status,
        "reply": confirmation.reply,
        "can_reply": form.delivery_date >= timezone.localdate(),
    }
    if confirmation.kind == Confirmation.Kind.SUPPLIER:
        data["order"] = supplier_order(form, confirmation.supplier)
    else:
        data["run"] = transport_run(form, confirmation.route)
        data["company"] = confirmation.company.name if confirmation.company else None
    return data


@method_decorator(csrf_protect, name="dispatch")
class ConfirmView(APIView):
    """What a supplier or transport company is asked to do, from the private link we send them.
    POST {"status": "confirmed" or "cant", "reply": "..."} answers. Public."""

    permission_classes = [AllowAny]

    def find(self, token):
        confirmation = Confirmation.objects.filter(token=token).select_related("form", "supplier", "route", "company").first()
        if confirmation is None:
            raise NotFound("This link doesn't work. Please ask the Square Roots team for a new one.")
        return confirmation

    def get(self, request, token):
        return Response(public_confirmation_json(self.find(token)))

    def post(self, request, token):
        confirmation = self.find(token)
        status = request.data.get("status")
        if status not in (Confirmation.Status.CONFIRMED, Confirmation.Status.CANT):
            raise ValidationError({"status": "Choose whether you can do it."})
        reply = (request.data.get("reply") or "").strip()[:500]
        if status == Confirmation.Status.CANT and not reply:
            raise ValidationError({"reply": "Tell us what you can't do, so the team can sort it out."})
        confirmation.status = status
        confirmation.reply = reply
        confirmation.replied_at = timezone.now()
        confirmation.save()
        who = confirmation.supplier.name if confirmation.supplier else (confirmation.company.name if confirmation.company else confirmation.route.name)
        notify_team(
            f"{who} {'confirmed' if status == 'confirmed' else 'can’t do'} the order for {confirmation.form.delivery_date}",
            reply or "No message.",
        )
        return Response(public_confirmation_json(confirmation))
