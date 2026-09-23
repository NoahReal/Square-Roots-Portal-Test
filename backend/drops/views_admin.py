"""API for the Admin role: drop cycles, the orders overview for a cycle, and impact numbers."""

import csv
from datetime import time, timedelta

from django.db import transaction
from django.db.models import Sum
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
from .models import BUNDLE_POUNDS, BundleOrder, DropCycle, Site, SiteDrop


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
            SiteDrop.objects.create(
                cycle=cycle, site=site, drop_date=cycle.drop_date, order_cutoff=cycle.order_cutoff,
                starts_at=data["starts_at"], ends_at=data["ends_at"],
            )
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
        "report": {"bundles_sold": report.bundles_sold, "bundles_left_over": report.bundles_left_over} if report else None,
    }


class CycleDetailView(APIView):
    """One drop cycle: every site's order, pounds needed, and the purchase list for each farm (Admins).

    PATCH changes the cycle's drop date or cutoff for every site; DELETE removes a cycle nobody has ordered in yet.
    """

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        site_drops = cycle.site_drops.select_related("site", "order", "report").prefetch_related("preorders")
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
                "farm_orders": [{**FarmOrderSerializer(order).data, "farm_name": order.farm.name} for order in farm_orders],
            }
        )

    @transaction.atomic
    def patch(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        if "drop_date" in request.data:
            cycle.drop_date = serializers.DateField().to_internal_value(request.data["drop_date"])
            cycle.name = cycle_name(cycle.drop_date)
        if "order_cutoff" in request.data:
            cycle.order_cutoff = serializers.DateTimeField().to_internal_value(request.data["order_cutoff"])
        if timezone.localtime(cycle.order_cutoff).date() >= cycle.drop_date:
            raise ValidationError({"order_cutoff": "Ordering should close before the drop date."})
        cycle.save()
        cycle.site_drops.update(drop_date=cycle.drop_date, order_cutoff=cycle.order_cutoff)
        return self.get(request, pk)

    def delete(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        if SiteDrop.objects.filter(cycle=cycle, order__isnull=False).exists() or cycle.farm_orders.exists():
            raise ValidationError({"detail": "Sites or farms already have orders in this cycle, so it can't be deleted."})
        cycle.delete()
        return Response(status=204)


class CycleSiteView(APIView):
    """Adds a location to a drop cycle (Admins)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        site = get_object_or_404(Site, pk=request.data.get("site"), is_active=True)
        SiteDrop.objects.get_or_create(
            cycle=cycle, site=site, defaults={"drop_date": cycle.drop_date, "order_cutoff": cycle.order_cutoff}
        )
        return CycleDetailView().get(request, pk)


class SiteDropDetailView(APIView):
    """Changes one site's drop date, hours or cutoff, or removes the site from the cycle if it hasn't ordered (Admins)."""

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        site_drop = get_object_or_404(SiteDrop, pk=pk)
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
        return CycleDetailView().get(request, site_drop.cycle_id)

    def delete(self, request, pk):
        site_drop = get_object_or_404(SiteDrop, pk=pk)
        if hasattr(site_drop, "order"):
            raise ValidationError({"detail": f"{site_drop.site} has already ordered, so it can't be removed."})
        cycle_id = site_drop.cycle_id
        site_drop.delete()
        return CycleDetailView().get(request, cycle_id)


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

    class Meta:
        model = Site
        fields = [
            "id", "name", "address", "instagram_url", "facebook_url", "highlight", "is_active", "sort_order",
            "people", "drops_this_year",
        ]
        extra_kwargs = {
            "name": {"error_messages": {"blank": "Give the location a name, like “Lower Sackville”."}},
            "address": {"error_messages": {"blank": "Add the street address."}},
            "instagram_url": {"error_messages": {"invalid": "Paste the full Instagram link, starting with https://"}},
            "facebook_url": {"error_messages": {"invalid": "Paste the full Facebook link, starting with https://"}},
        }

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
        sites = Site.objects.prefetch_related("people")
        return Response(LocationSerializer(sites, many=True).data)

    def post(self, request):
        serializer = LocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        last = Site.objects.order_by("-sort_order").first()
        serializer.save(sort_order=(last.sort_order + 1) if last else 0)
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
        unpaid = FarmOrder.objects.filter(
            status=FarmOrder.Status.CONFIRMED, payment=FarmOrder.Payment.NOT_PAID, pickup_at__lte=now
        ).select_related("farm", "drop_cycle").prefetch_related("lines")

        return Response(
            {
                "signups_waiting": Application.objects.filter(user__status=User.Status.PENDING).count(),
                "next_cycle": buying(next_cycle),
                "open_cycle": buying(open_cycle) if open_cycle and open_cycle != next_cycle else None,
                "sites_not_ordered": not_ordered,
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
            "Bundles left over", "Leftovers went to", "Pounds sold",
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
                report.bundles_left_over if report else "",
                report.get_leftovers_went_to_display() if report and report.bundles_left_over else "",
                report.bundles_sold * BUNDLE_POUNDS if report else "",
            ])
        return response

