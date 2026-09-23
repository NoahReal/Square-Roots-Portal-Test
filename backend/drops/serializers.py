from django.utils import timezone
from rest_framework import serializers

from .models import BUNDLE_POUNDS, DropReport, OperatingSettings, Preorder, Site, SiteDrop
from .money import for_json, statement


class SiteSerializer(serializers.ModelSerializer):
    """A location, as the public website shows it, with its next drop."""

    next_drop = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = ["id", "name", "address", "instagram_url", "facebook_url", "highlight", "delivery_partner", "next_drop"]

    def get_next_drop(self, site):
        today = timezone.localdate()
        drop = next((d for d in site.drops.all() if d.drop_date >= today), None)
        if drop is None:
            return None
        return {"drop_date": drop.drop_date, "starts_at": drop.starts_at, "ends_at": drop.ends_at}


class PreorderSerializer(serializers.ModelSerializer):
    price_tier_label = serializers.CharField(source="get_price_tier_display", read_only=True)

    class Meta:
        model = Preorder
        fields = [
            "id", "customer_name", "phone", "bundles", "price_tier", "price_tier_label",
            "delivery", "delivery_address", "paid", "picked_up",
        ]
        extra_kwargs = {
            "customer_name": {"error_messages": {"blank": "Please add the customer's name."}},
            "bundles": {"error_messages": {"invalid": "Enter a number of bundles, like 2."}},
        }

    def validate_customer_name(self, value):
        return value.strip()

    def validate_bundles(self, value):
        if value < 1:
            raise serializers.ValidationError("A preorder needs at least 1 bundle.")
        return value

    def validate(self, data):
        delivery = data.get("delivery", getattr(self.instance, "delivery", False))
        address = data.get("delivery_address", getattr(self.instance, "delivery_address", ""))
        if delivery and not address.strip():
            raise serializers.ValidationError({"delivery_address": "Add the address to deliver to."})
        return data


class DropReportSerializer(serializers.ModelSerializer):
    leftovers_label = serializers.CharField(source="get_leftovers_went_to_display", read_only=True)

    class Meta:
        model = DropReport
        fields = [
            "bundles_standard", "bundles_at_cost", "bundles_free", "bundles_sold", "bundles_left_over",
            "leftovers_went_to", "leftovers_label", "donations", "notes", "remittance_received_on", "updated_at",
        ]
        read_only_fields = ["bundles_sold", "remittance_received_on", "updated_at"]
        number = {"error_messages": {"invalid": "Enter a number, or 0 if none."}}
        extra_kwargs = {
            "bundles_standard": number,
            "bundles_at_cost": number,
            "bundles_free": number,
            "bundles_left_over": number,
            "donations": {"error_messages": {"invalid": "Enter an amount in dollars, like 12.50, or 0."}},
        }

    def validate_donations(self, value):
        if value < 0:
            raise serializers.ValidationError("Donations can't be below $0.")
        return value

    def validate(self, data):
        if data.get("bundles_left_over", 0) > 0 and data.get("leftovers_went_to") == DropReport.Leftovers.NONE:
            raise serializers.ValidationError({"leftovers_went_to": "Tell us what happened to the leftover bundles."})
        return data


class SiteDropSerializer(serializers.ModelSerializer):
    """A site's drop, with its order, preorder counts and report, for the Community Manager screens."""

    cycle_name = serializers.CharField(source="cycle.name", read_only=True)
    site_name = serializers.CharField(source="site.name", read_only=True)
    ordering_open = serializers.BooleanField(read_only=True)
    has_happened = serializers.BooleanField(read_only=True)
    bundles = serializers.SerializerMethodField()
    order_updated_at = serializers.SerializerMethodField()
    preorder_count = serializers.SerializerMethodField()
    preorder_bundles = serializers.SerializerMethodField()
    picked_up_count = serializers.SerializerMethodField()
    delivery_count = serializers.SerializerMethodField()
    delivery_partner = serializers.CharField(source="site.delivery_partner", read_only=True)
    report = serializers.SerializerMethodField()
    statement = serializers.SerializerMethodField()

    class Meta:
        model = SiteDrop
        fields = [
            "id", "cycle_name", "site_name", "drop_date", "starts_at", "ends_at", "order_cutoff",
            "ordering_open", "has_happened", "bundles", "order_updated_at",
            "preorder_count", "preorder_bundles", "picked_up_count", "delivery_count", "delivery_partner",
            "report", "statement",
        ]

    def _order(self, site_drop):
        return getattr(site_drop, "order", None)

    def get_bundles(self, site_drop):
        order = self._order(site_drop)
        return order.bundles if order else None

    def get_order_updated_at(self, site_drop):
        order = self._order(site_drop)
        return order.updated_at if order else None

    def get_preorder_count(self, site_drop):
        return len(site_drop.preorders.all())

    def get_preorder_bundles(self, site_drop):
        return sum(p.bundles for p in site_drop.preorders.all())

    def get_picked_up_count(self, site_drop):
        return sum(1 for p in site_drop.preorders.all() if p.picked_up)

    def get_delivery_count(self, site_drop):
        return sum(1 for p in site_drop.preorders.all() if p.delivery)

    def get_statement(self, site_drop):
        # Look the prices up once per list, not once per drop.
        if not hasattr(self, "_settings"):
            self._settings = OperatingSettings.current()
        result = statement(site_drop, self._settings)
        return for_json(result) if result else None

    def get_report(self, site_drop):
        report = getattr(site_drop, "report", None)
        return DropReportSerializer(report).data if report else None


def pounds(bundles):
    return bundles * BUNDLE_POUNDS
