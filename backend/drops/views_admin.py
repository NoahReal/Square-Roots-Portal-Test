"""API for the Admin role: drop cycles, the orders overview for a cycle, and impact numbers."""

import csv
from datetime import time, timedelta

from django.db import transaction
from django.db.models import Count, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Application, User
from accounts.notifications import notify_person
from accounts.permissions import IsAdminRole
from farms.models import FarmOrder, FarmOrderLine
from farms.serializers import FarmOrderSerializer
from .models import BUNDLE_POUNDS, BundleOrder, DropCycle, DropOffPoint, Route, Site, SiteDrop
from .reservations import apply_standing, tell_customers_drop_cancelled, tell_customers_drop_moved


def site_url(request):
    return f"{request.scheme}://{request.get_host()}"


def with_customers_told(response, emailed):
    """Adds how many customers were emailed about a change, so the screen can say so."""
    response.data["customers_emailed"] = emailed
    return response


def cycle_name(drop_date):
    return f"{drop_date:%B} {drop_date.day} drop"


def cycle_summary(cycle):
    """The numbers shown for a cycle in the Drop Cycles list."""
    site_drops = list(cycle.site_drops.all())
    orders = [d.order.bundles for d in site_drops if hasattr(d, "order")]
    return {
        "id": cycle.id,
        "name": cycle.name,
        "drop_date": cycle.drop_date,
        "order_cutoff": cycle.order_cutoff,
        "ordering_open": timezone.now() < cycle.order_cutoff,
        "has_happened": cycle.drop_date <= timezone.localdate(),
        "site_count": len(site_drops),
        "sites_ordered": len(orders),
        "bundles_ordered": sum(orders),
        "reports_in": sum(1 for d in site_drops if hasattr(d, "report")),
    }


def cycles_with_details():
    return DropCycle.objects.prefetch_related("site_drops__order", "site_drops__report")


class NewCycleSerializer(serializers.Serializer):
    drop_date = serializers.DateField(error_messages={"invalid": "Choose a drop date from the calendar."})
    order_cutoff = serializers.DateTimeField(error_messages={"invalid": "Choose when ordering closes."})
    sites = serializers.PrimaryKeyRelatedField(queryset=Site.objects.filter(is_active=True), many=True)
    starts_at = serializers.TimeField(default=time(11), error_messages={"invalid": "Choose a start time."})
    ends_at = serializers.TimeField(default=time(13), error_messages={"invalid": "Choose an end time."})

    def validate_drop_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("The drop date has already passed.")
        return value

    def validate_sites(self, value):
        if not value:
            raise serializers.ValidationError("Choose at least one location.")
        return value

    def validate(self, data):
        cutoff_day = timezone.localtime(data["order_cutoff"]).date()
        if cutoff_day >= data["drop_date"]:
            raise serializers.ValidationError({"order_cutoff": "Ordering should close before the drop date."})
        if data["ends_at"] <= data["starts_at"]:
            raise serializers.ValidationError({"ends_at": "The drop should end after it starts."})
        if DropCycle.objects.filter(drop_date=data["drop_date"]).exists():
            raise serializers.ValidationError({"drop_date": "There's already a drop cycle on this date."})
        return data


class CycleListView(APIView):
    """Lists drop cycles with how many sites have ordered, or creates a new cycle for chosen sites and hours (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response([cycle_summary(cycle) for cycle in cycles_with_details()])

    @transaction.atomic
    def post(self, request):
        serializer = NewCycleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cycle = DropCycle.objects.create(
            name=cycle_name(data["drop_date"]), drop_date=data["drop_date"], order_cutoff=data["order_cutoff"]
        )
        for site in data["sites"]:
            site_drop = SiteDrop.objects.create(
                cycle=cycle, site=site, drop_date=cycle.drop_date, order_cutoff=cycle.order_cutoff,
                starts_at=data["starts_at"], ends_at=data["ends_at"],
            )
            # Customers who reserve every drop here get a reservation for this one.
            apply_standing(site_drop, site_url(request))
        return Response(cycle_summary(cycles_with_details().get(pk=cycle.pk)), status=201)


def site_drop_row(site_drop):
    order = getattr(site_drop, "order", None)
    report = getattr(site_drop, "report", None)
    preorders = list(site_drop.preorders.all())
    return {
        "id": site_drop.id,
        "site_id": site_drop.site_id,
        "site_name": site_drop.site.name,
        "drop_date": site_drop.drop_date,
        "order_cutoff": site_drop.order_cutoff,
        "starts_at": site_drop.starts_at,
        "ends_at": site_drop.ends_at,
        "ordering_open": site_drop.ordering_open,
        "has_happened": site_drop.has_happened,
        "bundles": order.bundles if order else None,
        "preorder_bundles": sum(p.bundles for p in preorders),
        "online_bundles": sum(p.bundles for p in preorders if p.source == "online"),
        "waitlist_bundles": sum(w.bundles for w in site_drop.waitlist.all()),
        "report": {"bundles_sold": report.bundles_sold, "bundles_left_over": report.bundles_left_over} if report else None,
    }


class CycleDetailView(APIView):
    """One drop cycle: every site's order, pounds needed, and the purchase list for each farm (Admins).

    PATCH changes the cycle's drop date or cutoff for every site; DELETE removes a cycle nobody has ordered in yet.
    """

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        site_drops = cycle.site_drops.select_related("site", "order", "report").prefetch_related("preorders", "waitlist")
        rows = [site_drop_row(d) for d in site_drops]
        bundles = sum(row["bundles"] or 0 for row in rows)
        farm_orders = (
            FarmOrder.objects.filter(drop_cycle=cycle).select_related("farm", "drop_cycle").prefetch_related("lines")
        )
        bought = sum(line.pounds for order in farm_orders if order.status != FarmOrder.Status.CANT_FILL for line in order.lines.all())
        used_sites = {row["site_id"] for row in rows}
        return Response(
            {
                **cycle_summary(cycles_with_details().get(pk=cycle.pk)),
                "site_drops": rows,
                "other_sites": [
                    {"id": site.id, "name": site.name} for site in Site.objects.filter(is_active=True).exclude(id__in=used_sites)
                ],
                "pounds_needed": bundles * BUNDLE_POUNDS,
                "pounds_bought": bought,
                "unsent_farm_orders": sum(1 for order in farm_orders if order.sent_at is None),
                "farm_orders": [{**FarmOrderSerializer(order).data, "farm_name": order.farm.name} for order in farm_orders],
            }
        )

    @transaction.atomic
    def patch(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        old_date = cycle.drop_date
        if "drop_date" in request.data:
            cycle.drop_date = serializers.DateField().to_internal_value(request.data["drop_date"])
            cycle.name = cycle_name(cycle.drop_date)
        if "order_cutoff" in request.data:
            cycle.order_cutoff = serializers.DateTimeField().to_internal_value(request.data["order_cutoff"])
        if timezone.localtime(cycle.order_cutoff).date() >= cycle.drop_date:
            raise ValidationError({"order_cutoff": "Ordering should close before the drop date."})
        cycle.save()
        cycle.site_drops.update(drop_date=cycle.drop_date, order_cutoff=cycle.order_cutoff)
        emailed = 0
        if cycle.drop_date != old_date:
            for site_drop in cycle.site_drops.select_related("site"):
                emailed += tell_customers_drop_moved(site_drop, site_url(request))[0]
        return with_customers_told(self.get(request, pk), emailed)

    def delete(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        if SiteDrop.objects.filter(cycle=cycle, order__isnull=False).exists() or cycle.farm_orders.exists():
            raise ValidationError({"detail": "Sites or farms already have orders in this cycle, so it can't be deleted."})
        for site_drop in cycle.site_drops.select_related("site"):
            tell_customers_drop_cancelled(site_drop, site_url(request))
        cycle.delete()
        return Response(status=204)


class CycleSiteView(APIView):
    """Adds a location to a drop cycle (Admins)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        site = get_object_or_404(Site, pk=request.data.get("site"), is_active=True)
        site_drop, created = SiteDrop.objects.get_or_create(
            cycle=cycle, site=site, defaults={"drop_date": cycle.drop_date, "order_cutoff": cycle.order_cutoff}
        )
        if created:
            apply_standing(site_drop, site_url(request))
        return CycleDetailView().get(request, pk)


class SiteDropDetailView(APIView):
    """Changes one site's drop date, hours or cutoff, or removes the site from the cycle if it hasn't ordered (Admins)."""

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        site_drop = get_object_or_404(SiteDrop.objects.select_related("site"), pk=pk)
        before = (site_drop.drop_date, site_drop.starts_at, site_drop.ends_at)
        if "drop_date" in request.data:
            site_drop.drop_date = serializers.DateField().to_internal_value(request.data["drop_date"])
        if "order_cutoff" in request.data:
            site_drop.order_cutoff = serializers.DateTimeField().to_internal_value(request.data["order_cutoff"])
        for field in ("starts_at", "ends_at"):
            if field in request.data:
                setattr(site_drop, field, serializers.TimeField().to_internal_value(request.data[field]))
        if timezone.localtime(site_drop.order_cutoff).date() >= site_drop.drop_date:
            raise ValidationError({"order_cutoff": "Ordering should close before the drop date."})
        if site_drop.ends_at <= site_drop.starts_at:
            raise ValidationError({"ends_at": "The drop should end after it starts."})
        site_drop.save()
        emailed = 0
        # Customers only need to hear about changes to when the drop is, not the ordering cutoff.
        if (site_drop.drop_date, site_drop.starts_at, site_drop.ends_at) != before:
            emailed = tell_customers_drop_moved(site_drop, site_url(request))[0]
        return with_customers_told(CycleDetailView().get(request, site_drop.cycle_id), emailed)

    def delete(self, request, pk):
        site_drop = get_object_or_404(SiteDrop.objects.select_related("site"), pk=pk)
        if hasattr(site_drop, "order"):
            raise ValidationError({"detail": f"{site_drop.site} has already ordered, so it can't be removed."})
        cycle_id = site_drop.cycle_id
        emailed = tell_customers_drop_cancelled(site_drop, site_url(request))[0]
        site_drop.delete()
        return with_customers_told(CycleDetailView().get(request, cycle_id), emailed)


class SiteOrderView(APIView):
    """Sets a site's bundle order for them, even after the cutoff. Their Community Manager is emailed (Admins)."""

    permission_classes = [IsAdminRole]

    def put(self, request, pk):
        site_drop = get_object_or_404(SiteDrop.objects.select_related("site", "cycle"), pk=pk)
        try:
            bundles = int(request.data.get("bundles"))
        except (TypeError, ValueError):
            raise ValidationError({"bundles": "Enter a number of bundles."})
        if not 0 <= bundles <= 300:
            raise ValidationError({"bundles": "Enter a number from 0 to 300."})
        BundleOrder.objects.update_or_create(site_drop=site_drop, defaults={"bundles": bundles, "updated_by": request.user})
        for manager in site_drop.site.people.filter(role=User.Role.COMMUNITY_MANAGER, status=User.Status.APPROVED):
            notify_person(
                manager,
                f"Your order for the {site_drop.cycle.name} was changed",
                f"The Square Roots team set your order for {site_drop.site.name} to {bundles} bundles.",
            )
        return CycleDetailView().get(request, site_drop.cycle_id)


# ---------- Locations ----------


class LocationSerializer(serializers.ModelSerializer):
    people = serializers.SerializerMethodField()
    drops_this_year = serializers.SerializerMethodField()
    route = serializers.PrimaryKeyRelatedField(queryset=Route.objects.all(), allow_null=True, required=False)
    drop_off = serializers.PrimaryKeyRelatedField(queryset=DropOffPoint.objects.all(), allow_null=True, required=False)
    route_name = serializers.CharField(source="route.name", default=None, read_only=True)
    drop_off_name = serializers.CharField(source="drop_off.name", default=None, read_only=True)

    class Meta:
        model = Site
        fields = [
            "id", "name", "address", "instagram_url", "facebook_url", "highlight", "delivery_partner",
            "first_drop_pricing", "online_reservations", "reservation_limit", "is_active", "sort_order", "people",
            "drops_this_year", "route", "route_name", "drop_off", "drop_off_name",
        ]
        extra_kwargs = {
            "name": {"error_messages": {"blank": "Give the location a name, like “Lower Sackville”."}},
            "address": {"error_messages": {"blank": "Add the street address."}},
            "instagram_url": {"error_messages": {"invalid": "Paste the full Instagram link, starting with https://"}},
            "facebook_url": {"error_messages": {"invalid": "Paste the full Facebook link, starting with https://"}},
        }

    def validate(self, data):
        route = data.get("route", getattr(self.instance, "route", None))
        drop_off = data.get("drop_off", getattr(self.instance, "drop_off", None))
        if drop_off and drop_off.route_id != getattr(route, "id", None):
            raise serializers.ValidationError({"drop_off": f"{drop_off.name} is on the {drop_off.route.name} route."})
        return data

    def get_people(self, site):
        return [
            {"name": p.get_full_name(), "role_label": p.get_role_display()}
            for p in site.people.all()
            if p.status == User.Status.APPROVED
        ]

    def get_drops_this_year(self, site):
        return site.drops.filter(drop_date__year=timezone.localdate().year).count()


class LocationListView(APIView):
    """Lists every location (including switched-off ones) with who runs it, or adds a new location (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        sites = Site.objects.prefetch_related("people").select_related("route", "drop_off")
        return Response(LocationSerializer(sites, many=True).data)

    def post(self, request):
        serializer = LocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        last = Site.objects.order_by("-sort_order").first()
        # A location added here is new, so it gets the first-drop incentive unless the admin says otherwise.
        first_drop_pricing = request.data.get("first_drop_pricing", True)
        serializer.save(sort_order=(last.sort_order + 1) if last else 0, first_drop_pricing=first_drop_pricing)
        return Response(serializer.data, status=201)


class LocationDetailView(APIView):
    """Changes a location's details, or switches it off so it no longer appears on the website (Admins)."""

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        site = get_object_or_404(Site, pk=pk)
        serializer = LocationSerializer(site, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ---------- Admin home dashboard ----------


def remittances_outstanding():
    """Logged drops whose Community Manager hasn't paid Square Roots yet (this year)."""
    from .views_operations import statements_for

    rows = [
        r for r in statements_for(timezone.localdate().year)
        if not r["remittance_received_on"] and float(r["owed_to_square_roots"]) > 0
    ]
    return {"count": len(rows), "total": f"{sum(float(r['owed_to_square_roots']) for r in rows):.2f}"}


class DashboardView(APIView):
    """Everything waiting for the team, for the admin home page (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        now = timezone.now()
        today = timezone.localdate()

        next_cycle = cycles_with_details().filter(drop_date__gte=today).order_by("drop_date").first()
        open_cycle = cycles_with_details().filter(order_cutoff__gt=now).order_by("order_cutoff").first()

        def buying(cycle):
            if cycle is None:
                return None
            summary = cycle_summary(cycle)
            bought = FarmOrderLine.objects.filter(order__drop_cycle=cycle).exclude(
                order__status=FarmOrder.Status.CANT_FILL
            ).aggregate(total=Sum("pounds"))["total"] or 0
            return {**summary, "pounds_needed": summary["bundles_ordered"] * BUNDLE_POUNDS, "pounds_bought": bought}

        not_ordered = []
        if open_cycle:
            not_ordered = [
                drop.site.name
                for drop in open_cycle.site_drops.select_related("site")
                if not hasattr(drop, "order")
            ]

        reports_missing = [
            {"site": d.site.name, "cycle_name": d.cycle.name, "drop_date": d.drop_date}
            for d in SiteDrop.objects.filter(drop_date__lt=today, drop_date__gte=today - timedelta(weeks=6), order__isnull=False, report__isnull=True)
            .select_related("site", "cycle")
            .order_by("-drop_date")
        ]

        waiting_farms = [
            {"id": o.id, "farm": o.farm.name, "cycle_id": o.drop_cycle_id, "cycle_name": o.drop_cycle.name, "pickup_at": o.pickup_at}
            for o in FarmOrder.objects.filter(status=FarmOrder.Status.WAITING, pickup_at__gt=now).select_related("farm", "drop_cycle")
        ]
        to_send = (
            FarmOrder.objects.filter(sent_at__isnull=True, drop_cycle__order_cutoff__lte=now, drop_cycle__drop_date__gte=today)
            .values("drop_cycle_id", "drop_cycle__name")
            .annotate(count=Count("id"))
        )
        unpaid = FarmOrder.objects.filter(
            status=FarmOrder.Status.CONFIRMED, payment=FarmOrder.Payment.NOT_PAID, pickup_at__lte=now
        ).select_related("farm", "drop_cycle").prefetch_related("lines")

        return Response(
            {
                "signups_waiting": Application.objects.filter(user__status=User.Status.PENDING).count(),
                "next_cycle": buying(next_cycle),
                "open_cycle": buying(open_cycle) if open_cycle and open_cycle != next_cycle else None,
                "sites_not_ordered": not_ordered,
                "orders_to_send": [
                    {"cycle_id": row["drop_cycle_id"], "cycle_name": row["drop_cycle__name"], "count": row["count"]}
                    for row in to_send
                ],
                "remittances_outstanding": remittances_outstanding(),
                "reports_missing": reports_missing,
                "farms_waiting": waiting_farms,
                "unpaid_farm_orders": [
                    {"id": o.id, "farm": o.farm.name, "cycle_id": o.drop_cycle_id, "cycle_name": o.drop_cycle.name, "total": o.total}
                    for o in unpaid
                ],
            }
        )


# ---------- Impact ----------


def impact_numbers(year):
    """Everything on the Impact screen for one year."""
    today = timezone.localdate()
    site_drops = SiteDrop.objects.filter(drop_date__year=year, drop_date__lte=today).select_related("site", "cycle", "order", "report")
    reports = [d.report for d in site_drops if hasattr(d, "report")]

    # Produce diverted = pounds bought from farms and picked up (orders the farm could fill).
    bought = FarmOrderLine.objects.filter(
        order__drop_cycle__drop_date__year=year,
        order__pickup_at__lte=timezone.now(),
        order__status=FarmOrder.Status.CONFIRMED,
    )

    cycles = {}
    for drop in site_drops:
        entry = cycles.setdefault(drop.cycle_id, {"name": drop.cycle.name, "drop_date": drop.cycle.drop_date, "bundles_sold": 0, "sites": 0})
        entry["sites"] += 1
        if hasattr(drop, "report"):
            entry["bundles_sold"] += drop.report.bundles_sold
    pounds_by_cycle = dict(bought.values_list("order__drop_cycle_id").annotate(total=Sum("pounds")))
    for cycle_id, entry in cycles.items():
        entry["pounds_diverted"] = pounds_by_cycle.get(cycle_id, 0)

    sites = {}
    for drop in site_drops:
        entry = sites.setdefault(drop.site.name, {"site": drop.site.name, "drops": 0, "bundles_sold": 0, "bundles_left_over": 0})
        entry["drops"] += 1
        if hasattr(drop, "report"):
            entry["bundles_sold"] += drop.report.bundles_sold
            entry["bundles_left_over"] += drop.report.bundles_left_over

    leftovers = {}
    for report in reports:
        if report.bundles_left_over:
            label = report.get_leftovers_went_to_display()
            leftovers[label] = leftovers.get(label, 0) + report.bundles_left_over

    return {
        "year": year,
        "years": sorted({d.year for d in DropCycle.objects.dates("drop_date", "year")} | {today.year}, reverse=True),
        "totals": {
            "pounds_diverted": bought.aggregate(total=Sum("pounds"))["total"] or 0,
            "bundles_sold": sum(r.bundles_sold for r in reports),
            "bundles_standard": sum(r.bundles_standard for r in reports),
            "bundles_at_cost": sum(r.bundles_at_cost for r in reports),
            "bundles_free": sum(r.bundles_free for r in reports),
            "donations": f"{sum(r.donations for r in reports):.2f}",
            "paid_to_farms": f"{sum(line.pounds * line.price_per_pound for line in bought):.2f}",
            "pounds_to_community": sum(r.bundles_sold for r in reports) * BUNDLE_POUNDS,
            "sites_active": len(sites),
            "drops_held": len(site_drops),
            "farms_supplying": bought.values("order__farm").distinct().count(),
        },
        "by_cycle": sorted(cycles.values(), key=lambda c: c["drop_date"]),
        "by_site": sorted(sites.values(), key=lambda s: -s["bundles_sold"]),
        "leftovers": [{"label": label, "bundles": n} for label, n in sorted(leftovers.items(), key=lambda x: -x[1])],
        "reports_missing": sum(1 for d in site_drops if not hasattr(d, "report") and hasattr(d, "order")),
    }


def year_from(request):
    try:
        return int(request.query_params.get("year", timezone.localdate().year))
    except ValueError:
        return timezone.localdate().year


class ImpactView(APIView):
    """Pounds diverted, bundles sold, sites active and more, for one year. Add ?year=2026 (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(impact_numbers(year_from(request)))


class ImpactCsvView(APIView):
    """Downloads every drop in a year as a spreadsheet (CSV), one row per site per drop. Add ?year=2026 (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        year = year_from(request)
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="square-roots-impact-{year}.csv"'
        writer = csv.writer(response)
        writer.writerow([
            "Drop date", "Drop cycle", "Location", "Bundles ordered", "Bundles sold",
            "Standard", "At cost", "Free", "Bundles left over", "Leftovers went to", "Pounds sold", "Donations",
        ])
        site_drops = (
            SiteDrop.objects.filter(drop_date__year=year, drop_date__lte=timezone.localdate())
            .select_related("site", "cycle", "order", "report")
            .order_by("drop_date", "site__sort_order")
        )
        for drop in site_drops:
            order = getattr(drop, "order", None)
            report = getattr(drop, "report", None)
            writer.writerow([
                drop.drop_date.isoformat(),
                drop.cycle.name,
                drop.site.name,
                order.bundles if order else "",
                report.bundles_sold if report else "",
                report.bundles_standard if report else "",
                report.bundles_at_cost if report else "",
                report.bundles_free if report else "",
                report.bundles_left_over if report else "",
                report.get_leftovers_went_to_display() if report and report.bundles_left_over else "",
                report.bundles_sold * BUNDLE_POUNDS if report else "",
                f"{report.donations:.2f}" if report else "",
            ])
        return response



# ---------- Routes ----------

WEEKDAY_NAMES = dict(Route._meta.get_field("trucks_on").choices)


def route_json(route):
    sites = list(route.sites.all())
    return {
        "id": route.id,
        "name": route.name,
        "description": route.description,
        "form_sent_on": WEEKDAY_NAMES[route.form_sent_on],
        "orders_due_on": WEEKDAY_NAMES[route.orders_due_on],
        "trucks_on": WEEKDAY_NAMES[route.trucks_on],
        # Markets are usually the day after the trucks come; each location decides.
        "markets_usually_on": WEEKDAY_NAMES[(route.trucks_on + 1) % 7],
        "shares_form_with": route.shares_form_with.name if route.shares_form_with else None,
        "suppliers": [{"id": f.id, "name": f.name, "kind": f.get_kind_display()} for f in route.suppliers.all()],
        "drop_off_points": [
            {
                "id": point.id,
                "name": point.name,
                "hub_site": point.hub_site.name if point.hub_site else None,
                "hub_share_percent": f"{point.hub_share_percent.normalize():f}",
                "hub_share_supplier": point.hub_share_supplier.name if point.hub_share_supplier else None,
                "notes": point.notes,
                "sites": [site.name for site in sites if site.drop_off_id == point.id],
            }
            for point in route.drop_off_points.all()
        ],
        "sites": [{"id": site.id, "name": site.name, "drop_off": site.drop_off.name if site.drop_off else None} for site in sites],
    }


class RouteListView(APIView):
    """The delivery routes: their weekly days, suppliers, drop-off points (hubs) and locations (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        routes = Route.objects.prefetch_related(
            "suppliers", "drop_off_points__hub_site", "drop_off_points__hub_share_supplier", "sites__drop_off"
        ).select_related("shares_form_with")
        unassigned = Site.objects.filter(is_active=True, route__isnull=True)
        return Response(
            {
                "routes": [route_json(route) for route in routes],
                "unassigned_sites": [{"id": site.id, "name": site.name} for site in unassigned],
            }
        )
