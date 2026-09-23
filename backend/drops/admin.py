from django.contrib import admin

from .models import Site


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ["name", "address", "is_active", "sort_order"]
    list_editable = ["is_active", "sort_order"]
