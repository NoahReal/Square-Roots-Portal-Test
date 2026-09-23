from django.contrib import admin

from .models import BundleOrder, DropCycle, DropReport, OperatingSettings, Preorder, Site, SiteDrop, WaitlistEntry


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ["name", "address", "is_active", "sort_order"]
    list_editable = ["is_active", "sort_order"]


@admin.register(DropCycle)
class DropCycleAdmin(admin.ModelAdmin):
    list_display = ["name", "drop_date", "order_cutoff"]


@admin.register(SiteDrop)
class SiteDropAdmin(admin.ModelAdmin):
    list_display = ["site", "cycle", "drop_date", "order_cutoff"]
    list_filter = ["cycle", "site"]


admin.site.register([BundleOrder, Preorder, WaitlistEntry, DropReport, OperatingSettings])
