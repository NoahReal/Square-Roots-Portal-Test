"""API for the Admin role: prices and logistics settings, money owed by each drop, and the
packing and delivery sheet for a drop cycle."""

import csv
from collections import defaultdict

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsAdminRole
from farms.models import FarmOrder
from farms.serializers import FarmOrderSerializer
from .models import BUNDLE_POUNDS, DropCycle, DropReport, OperatingSettings, SiteDrop
from .money import for_json, statement


# ---------- Settings ----------

PRICE_ERRORS = {"error_messages": {"invalid": "Enter an amount in dollars, like 7.50."}}


class SettingsSerializer(serializers.ModelSerializer):
    manager_share = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)

    class Meta:
        model = OperatingSettings
        fields = ["standard_price", "at_cost_price", "manager_share", "first_drop_cost", "delivery_fee", "staging_location"]
        extra_kwargs = {name: PRICE_ERRORS for name in ["standard_price", "at_cost_price", "first_drop_cost", "delivery_fee"]}

    def validate(self, data):
        standard = data.get("standard_price", self.instance.standard_price)
        at_cost = data.get("at_cost_price", self.instance.at_cost_price)
        if at_cost > standard:
            raise serializers.ValidationError({"at_cost_price": "The at-cost price can't be more than the standard price."})
        for name, value in data.items():
            if name != "staging_location" and value < 0:
                raise serializers.ValidationError({name: "Prices can't be below $0."})
        return data


class SettingsView(APIView):
    """Bundle prices, the first-drop incentive, the delivery fee and the sorting location (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(SettingsSerializer(OperatingSettings.current()).data)

    def patch(self, request):
        serializer = SettingsSerializer(OperatingSettings.current(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ---------- Money ----------


def statements_for(year):
    """A statement for every logged drop in a year, newest first."""
    settings = OperatingSettings.current()
    drops = (
        SiteDrop.objects.filter(drop_date__year=year, report__isnull=False)
        .select_related("site", "cycle", "report")
        .prefetch_related("preorders")
        .order_by("-drop_date", "site__sort_order")
    )
    # A new location's first drop that anyone ordered for gets the first-drop price.
    first_drop_ids = set()
    seen_sites = set()
    new_locations = SiteDrop.objects.filter(order__isnull=False, site__first_drop_pricing=True)
    for drop in new_locations.order_by("drop_date").only("id", "site_id"):
        if drop.site_id not in seen_sites:
            seen_sites.add(drop.site_id)
            first_drop_ids.add(drop.id)
    managers = defaultdict(list)
    for person in User.objects.filter(role=User.Role.COMMUNITY_MANAGER, status=User.Status.APPROVED, site__isnull=False):
        managers[person.site_id].append(person.get_full_name())

    rows = []
    for drop in drops:
        report = drop.report
        rows.append(
            {
                "site_drop_id": drop.id,
                "site": drop.site.name,
                "managers": managers.get(drop.site_id, []),
                "cycle_name": drop.cycle.name,
                "drop_date": drop.drop_date,
                "bundles_standard": report.bundles_standard,
                "bundles_at_cost": report.bundles_at_cost,
                "bundles_free": report.bundles_free,
                **for_json(statement(drop, settings, first_drop=drop.id in first_drop_ids)),
            }
        )
    return rows


def year_param(request):
    try:
        return int(request.query_params.get("year", timezone.localdate().year))
    except ValueError:
        return timezone.localdate().year


class MoneyView(APIView):
    """What each drop collected, what its Community Manager owes Square Roots, and whether it's been received (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        rows = statements_for(year_param(request))
        outstanding = [r for r in rows if not r["remittance_received_on"] and float(r["owed_to_square_roots"]) > 0]

        def total(key, subset=rows):
            return f"{sum(float(r[key]) for r in subset):.2f}"

        return Response(
            {
                "year": year_param(request),
                "statements": rows,
                "totals": {
                    "collected": total("collected"),
                    "owed_to_square_roots": total("owed_to_square_roots"),
                    "outstanding": total("owed_to_square_roots", outstanding),
                    "outstanding_count": len(outstanding),
                    "manager_keeps": total("manager_keeps"),
                    "donations": total("donations"),
                    "bundles_free": sum(r["bundles_free"] for r in rows),
                    "bundles_at_cost": sum(r["bundles_at_cost"] for r in rows),
                    "bundles_standard": sum(r["bundles_standard"] for r in rows),
                },
            }
        )


class RemittanceView(APIView):
    """Records that a Community Manager's payment for a drop arrived (POST), or undoes it (DELETE) (Admins)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        report = get_object_or_404(DropReport, site_drop_id=pk)
        report.remittance_received_on = timezone.localdate()
        report.save(update_fields=["remittance_received_on"])
        return Response({"remittance_received_on": report.remittance_received_on})

    def delete(self, request, pk):
        report = get_object_or_404(DropReport, site_drop_id=pk)
        report.remittance_received_on = None
        report.save(update_fields=["remittance_received_on"])
        return Response({"remittance_received_on": None})


class MoneyCsvView(APIView):
    """Downloads a year of drop statements as a spreadsheet (CSV), one row per location per drop (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        year = year_param(request)
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="square-roots-money-{year}.csv"'
        writer = csv.writer(response)
        writer.writerow([
            "Drop date", "Location", "Community Manager", "Standard bundles", "At-cost bundles", "Free bundles",
            "Collected", "Owed to Square Roots", "Donations", "Community Manager keeps", "First drop", "Payment received",
        ])
        for row in reversed(statements_for(year)):
            writer.writerow([
                row["drop_date"].isoformat(), row["site"], ", ".join(row["managers"]),
                row["bundles_standard"], row["bundles_at_cost"], row["bundles_free"],
                row["collected"], row["owed_to_square_roots"], row["donations"], row["manager_keeps"],
                "yes" if row["first_drop"] else "", row["remittance_received_on"] or "",
            ])
        return response


# ---------- Packing and delivery ----------


def deliveries_for(cycle):
    return [
        {
            "site": p.site_drop.site.name,
            "partner": p.site_drop.site.delivery_partner,
            "customer_name": p.customer_name,
            "phone": p.phone,
            "address": p.delivery_address,
            "bundles": p.bundles,
            "paid": p.paid,
            "drop_date": p.site_drop.drop_date,
        }
        for drop in cycle.site_drops.select_related("site").prefetch_related("preorders")
        for p in drop.preorders.all()
        if p.delivery
    ]


class LogisticsView(APIView):
    """The packing and delivery sheet for a drop: what arrives from farms, how to sort it into
    10 lb bundles, what each location gets, and the home deliveries (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        drops = cycle.site_drops.select_related("site", "order").prefetch_related("preorders", "site__people")
        bundles_total = sum(d.order.bundles for d in drops if hasattr(d, "order"))

        farm_orders = (
            FarmOrder.objects.filter(drop_cycle=cycle).exclude(status=FarmOrder.Status.CANT_FILL)
            .select_related("farm", "drop_cycle").prefetch_related("lines").order_by("pickup_at")
        )
        # Sorting guide: how much of each kind of produce goes in each bundle.
        produce = defaultdict(int)
        for order in farm_orders:
            for line in order.lines.all():
                produce[line.produce] += line.pounds
        sorting = [
            {"produce": name, "pounds": pounds, "per_bundle": round(pounds / bundles_total, 1) if bundles_total else None}
            for name, pounds in sorted(produce.items(), key=lambda item: -item[1])
        ]

        sites = []
        for drop in drops:
            managers = [
                {"name": p.get_full_name(), "phone": p.phone}
                for p in drop.site.people.all()
                if p.role == User.Role.COMMUNITY_MANAGER and p.status == User.Status.APPROVED
            ]
            sites.append(
                {
                    "site": drop.site.name,
                    "address": drop.site.address,
                    "drop_date": drop.drop_date,
                    "starts_at": drop.starts_at,
                    "ends_at": drop.ends_at,
                    "bundles": drop.order.bundles if hasattr(drop, "order") else None,
                    "deliveries": sum(1 for p in drop.preorders.all() if p.delivery),
                    "managers": managers,
                }
            )

        return Response(
            {
                "id": cycle.id,
                "name": cycle.name,
                "drop_date": cycle.drop_date,
                "staging_location": OperatingSettings.current().staging_location,
                "bundles_total": bundles_total,
                "pounds_needed": bundles_total * BUNDLE_POUNDS,
                "pounds_arriving": sum(produce.values()),
                "farm_orders": [{**FarmOrderSerializer(o).data, "farm_name": o.farm.name} for o in farm_orders],
                "sorting": sorting,
                "sites": sites,
                "deliveries": deliveries_for(cycle),
            }
        )


class DeliveriesCsvView(APIView):
    """Downloads a drop's home deliveries as a spreadsheet (CSV), for the delivery partner (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request, pk):
        cycle = get_object_or_404(DropCycle, pk=pk)
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="deliveries-{cycle.drop_date}.csv"'
        writer = csv.writer(response)
        writer.writerow(["Date", "Location", "Delivery partner", "Customer", "Phone", "Address", "Bundles", "Paid"])
        for d in deliveries_for(cycle):
            writer.writerow([
                d["drop_date"].isoformat(), d["site"], d["partner"], d["customer_name"], d["phone"], d["address"],
                d["bundles"], "yes" if d["paid"] else "no",
            ])
        return response

