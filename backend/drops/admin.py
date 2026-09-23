from django.contrib import admin

from .models import DropCycle, Site


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ["name", "address", "is_active", "sort_order"]
    list_editable = ["is_active", "sort_order"]


@admin.register(DropCycle)
class DropCycleAdmin(admin.ModelAdmin):
    list_display = ["name", "drop_date", "order_cutoff"]
