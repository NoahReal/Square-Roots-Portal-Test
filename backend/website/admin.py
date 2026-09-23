from django.contrib import admin

from .models import ContactMessage, Event


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ["first_name", "last_name", "email", "created_at"]
    readonly_fields = ["created_at"]


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "starts_on", "location", "is_published"]
