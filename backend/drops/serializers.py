from rest_framework import serializers

from .models import BUNDLE_POUNDS, DropReport, Preorder, Site, SiteDrop


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = ["id", "name", "address", "instagram_url", "facebook_url", "highlight"]


class PreorderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Preorder
        fields = ["id", "customer_name", "phone", "bundles", "paid", "picked_up"]
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


class DropReportSerializer(serializers.ModelSerializer):
    leftovers_label = serializers.CharField(source="get_leftovers_went_to_display", read_only=True)

    class Meta:
        model = DropReport
        fields = ["bundles_sold", "bundles_left_over", "leftovers_went_to", "leftovers_label", "notes", "updated_at"]
        read_only_fields = ["updated_at"]
        extra_kwargs = {
            "bundles_sold": {"error_messages": {"invalid": "Enter how many bundles you sold, like 24."}},
            "bundles_left_over": {"error_messages": {"invalid": "Enter a number, or 0 if none were left."}},
        }

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
    report = serializers.SerializerMethodField()

    class Meta:
        model = SiteDrop
        fields = [
            "id", "cycle_name", "site_name", "drop_date", "starts_at", "ends_at", "order_cutoff",
            "ordering_open", "has_happened", "bundles", "order_updated_at",
            "preorder_count", "preorder_bundles", "picked_up_count", "report",
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

    def get_report(self, site_drop):
        report = getattr(site_drop, "report", None)
        return DropReportSerializer(report).data if report else None


def pounds(bundles):
    return bundles * BUNDLE_POUNDS
