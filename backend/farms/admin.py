from django.contrib import admin

from .models import Farm, FarmOrder, FarmOrderLine, ProduceListing


@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ["name", "location"]


@admin.register(ProduceListing)
class ProduceListingAdmin(admin.ModelAdmin):
    list_display = ["produce", "farm", "pounds", "price_per_pound", "available_until", "is_active"]
    list_filter = ["farm", "is_active"]


class FarmOrderLineInline(admin.TabularInline):
    model = FarmOrderLine
    extra = 1


# Until the admin Orders screen is built (step 4), the team creates farm orders
# and marks them paid here.
@admin.register(FarmOrder)
class FarmOrderAdmin(admin.ModelAdmin):
    list_display = ["farm", "drop_cycle", "pickup_at", "status", "payment"]
    list_filter = ["farm", "status", "payment"]
    list_editable = ["payment"]
    inlines = [FarmOrderLineInline]
