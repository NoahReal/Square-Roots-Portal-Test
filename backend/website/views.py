from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.notifications import notify_team
from accounts.permissions import IsAdminRole
from .models import ContactMessage, Event


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["first_name", "last_name", "email", "message"]


@method_decorator(csrf_protect, name="dispatch")
class ContactView(APIView):
    """Sends a message from the public Contact Us form to the Square Roots team."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ContactMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        notify_team(
            subject=f"New message from {message.first_name} {message.last_name}",
            body=f"From: {message.email}\n\n{message.message}",
        )
        return Response({"ok": True}, status=201)


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ["id", "title", "starts_on", "ends_on", "time_text", "location", "description", "is_published"]
        extra_kwargs = {
            "title": {"error_messages": {"blank": "Give the event a name."}},
            "starts_on": {"error_messages": {"invalid": "Choose the date from the calendar."}},
            "description": {"error_messages": {"blank": "Say a little about the event."}},
        }

    def validate(self, data):
        starts = data.get("starts_on", getattr(self.instance, "starts_on", None))
        ends = data.get("ends_on", getattr(self.instance, "ends_on", None))
        if starts and ends and ends < starts:
            raise serializers.ValidationError({"ends_on": "The last day can't be before the first day."})
        return data


class PublicEventsView(APIView):
    """Upcoming events and the five most recent past ones. Public: shown on the Events page."""

    permission_classes = [AllowAny]

    def get(self, request):
        today = timezone.localdate()
        events = Event.objects.filter(is_published=True)
        still_on = Q(starts_on__gte=today) | Q(ends_on__gte=today)
        return Response(
            {
                "upcoming": EventSerializer(events.filter(still_on), many=True).data,
                "past": EventSerializer(events.exclude(still_on).order_by("-starts_on")[:5], many=True).data,
            }
        )


class AdminEventListView(APIView):
    """Lists every event, newest first, or adds one (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(EventSerializer(Event.objects.order_by("-starts_on"), many=True).data)

    def post(self, request):
        serializer = EventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class AdminEventDetailView(APIView):
    """Changes, hides or deletes an event (Admins)."""

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        serializer = EventSerializer(get_object_or_404(Event, pk=pk), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        get_object_or_404(Event, pk=pk).delete()
        return Response(status=204)
