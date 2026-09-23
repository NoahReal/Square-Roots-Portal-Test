from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Application, User


@admin.register(User)
class PortalUserAdmin(UserAdmin):
    list_display = ["username", "first_name", "last_name", "role", "status", "site", "is_active"]
    list_filter = ["role", "status", "is_active"]
    fieldsets = UserAdmin.fieldsets + (("Portal", {"fields": ["role", "status", "phone", "site"]}),)


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "site", "planned_location", "submitted_at", "reviewed_at"]
    readonly_fields = ["submitted_at"]
