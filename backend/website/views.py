import re

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.notifications import notify_team
from accounts.permissions import IsAdminRole
from .models import AreaRequest, ContactMessage, Event, PageText


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["first_name", "last_name", "email", "message"]


@method_decorator(csrf_protect, name="dispatch")
class ContactView(APIView):
    """Sends a message from the public Contact Us form to the Square Roots team."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"

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


# ---------- "Bring Square Roots to my area" ----------

POSTAL_CODE = re.compile(r"^([A-Z]\d[A-Z])\s?(\d[A-Z]\d)?$")


class AreaRequestSerializer(serializers.ModelSerializer):
    area = serializers.CharField(read_only=True)

    class Meta:
        model = AreaRequest
        fields = ["id", "email", "postal_code", "area", "town", "note", "could_help", "created_at"]
        extra_kwargs = {
            "email": {"error_messages": {"blank": "Add your email, so we can tell you if a location opens.",
                                         "invalid": "Check your email address, like name@example.com."}},
            "postal_code": {"error_messages": {"blank": "Add your postal code, like B3H 1G3."}},
        }

    def validate_postal_code(self, value):
        match = POSTAL_CODE.match(value.strip().upper())
        if not match:
            raise serializers.ValidationError("Check your postal code, like B3H 1G3 (or just the first part, B3H).")
        return " ".join(part for part in match.groups() if part)


@method_decorator(csrf_protect, name="dispatch")
class AreaRequestView(APIView):
    """Asks for a Square Roots location near you. Public (limited per visitor)."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"

    def post(self, request):
        serializer = AreaRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        area_request = serializer.save()
        if area_request.could_help:
            notify_team(
                subject=f"Someone near {area_request.area} would like to help start a location",
                body=f"{area_request.email} ({area_request.postal_code} {area_request.town}) asked for a location "
                f"and said they could help run or host it.\n\n{area_request.note}",
            )
        return Response({"ok": True, "area": area_request.area}, status=201)


class AdminAreaRequestView(APIView):
    """Location requests from the website, grouped by area (the first half of the postal code), busiest first (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        requests = list(AreaRequest.objects.all())
        areas = {}
        for item in requests:
            area = areas.setdefault(item.area, {"area": item.area, "requests": 0, "could_help": 0, "towns": set(), "latest": item.created_at})
            area["requests"] += 1
            area["could_help"] += item.could_help
            if item.town:
                area["towns"].add(item.town.strip())
        return Response(
            {
                "areas": sorted(
                    ({**a, "towns": sorted(a["towns"])} for a in areas.values()),
                    key=lambda a: (-a["requests"], a["area"]),
                ),
                "requests": AreaRequestSerializer(requests, many=True).data,
            }
        )


class AdminAreaRequestDetailView(APIView):
    """Deletes a location request, for example if the person asks us to (Admins)."""

    permission_classes = [IsAdminRole]

    def delete(self, request, pk):
        get_object_or_404(AreaRequest, pk=pk).delete()
        return Response(status=204)


# ---------- Website text the team can edit ----------

KEY = re.compile(r"^[a-z0-9_.-]{1,100}$")


class SiteTextView(APIView):
    """Website text the Square Roots team has changed, as {block: text}. Public: the website reads it when it loads."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({block.key: block.text for block in PageText.objects.all()})


class AdminSiteTextView(APIView):
    """Changes a block of website text (PUT {key, text}), or puts it back to the original (DELETE {key}) (Admins)."""

    permission_classes = [IsAdminRole]

    def put(self, request):
        key = request.data.get("key") or ""
        text = (request.data.get("text") or "").strip()
        if not KEY.match(key):
            raise ValidationError({"key": "Unknown text block."})
        if not text:
            raise ValidationError({"text": "The text can't be empty. Use “Reset to the original” instead."})
        if len(text) > 3000:
            raise ValidationError({"text": "Please keep this under 3,000 characters."})
        PageText.objects.update_or_create(key=key, defaults={"text": text, "updated_by": request.user})
        return SiteTextView().get(request)

    def delete(self, request):
        PageText.objects.filter(key=request.data.get("key") or "").delete()
        return SiteTextView().get(request)


# ---------- For search engines ----------

# The public pages worth finding in a search. Keep in step with the routes in frontend/src/App.jsx.
PUBLIC_PAGES = [
    "/", "/about", "/drop-dates-locations", "/reserve", "/whats-in-the-bundle", "/for-farms",
    "/become-a-community-manager", "/events", "/contact-us", "/request-a-location", "/signup", "/privacy",
]


def site_address(request):
    return f"{request.scheme}://{request.get_host()}"


def sitemap(request):
    """sitemap.xml: the public pages, so search engines find them all."""
    urls = "".join(f"  <url><loc>{site_address(request)}{path}</loc></url>\n" for path in PUBLIC_PAGES)
    xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n'
    return HttpResponse(xml, content_type="application/xml")


def robots(request):
    """robots.txt: search engines may read the public site, but not the partner portal or private links."""
    lines = [
        "User-agent: *",
        "Disallow: /portal/",
        "Disallow: /reserve/manage/",
        "Disallow: /confirm/",
        "Disallow: /api/",
        f"Sitemap: {site_address(request)}/sitemap.xml",
    ]
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain")
