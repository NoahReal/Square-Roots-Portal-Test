from datetime import date

from rest_framework import serializers

from .models import FarmOrder, FarmOrderLine, ProduceListing


class ProduceListingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProduceListing
        fields = ["id", "produce", "pounds", "price_per_pound", "available_until", "notes", "updated_at"]
        read_only_fields = ["updated_at"]
        # Plain-language messages instead of DRF's defaults ("A valid integer is required.")
        extra_kwargs = {
            "produce": {"error_messages": {"blank": "Please say what the produce is."}},
            "pounds": {"error_messages": {"invalid": "Enter a whole number of pounds, like 250."}},
            "price_per_pound": {"error_messages": {"invalid": "Enter a price, like 0.35."}},
            "available_until": {"error_messages": {"invalid": "Choose a date from the calendar."}},
        }

    def to_internal_value(self, data):
        # A blank "available until" box means no end date.
        if data.get("available_until") == "":
            data = {**data, "available_until": None}
        return super().to_internal_value(data)

    def validate_produce(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Please say what the produce is.")
        return value[:1].upper() + value[1:]

    def validate_pounds(self, value):
        if value < 1:
            raise serializers.ValidationError("Enter at least 1 pound.")
        return value

    def validate_price_per_pound(self, value):
        if value <= 0:
            raise serializers.ValidationError("Enter a price above $0.")
        return value

    def validate_available_until(self, value):
        if value and value < date.today():
            raise serializers.ValidationError("This date has already passed.")
        return value


class FarmOrderLineSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = FarmOrderLine
        fields = ["id", "produce", "pounds", "price_per_pound", "total"]


class FarmOrderSerializer(serializers.ModelSerializer):
    lines = FarmOrderLineSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    drop_cycle_name = serializers.CharField(source="drop_cycle.name", read_only=True)
    drop_date = serializers.DateField(source="drop_cycle.drop_date", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    payment_label = serializers.CharField(source="get_payment_display", read_only=True)

    class Meta:
        model = FarmOrder
        fields = [
            "id", "drop_cycle_name", "drop_date", "pickup_at", "pickup_notes",
            "status", "status_label", "farm_note", "responded_at",
            "payment", "payment_label", "paid_on", "lines", "total",
        ]
