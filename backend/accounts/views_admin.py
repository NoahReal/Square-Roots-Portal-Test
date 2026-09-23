"""API for the Admin role: everyone who can use the portal, and what they're linked to."""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from drops.models import Site
from farms.models import Farm
from .models import User
from .permissions import IsAdminRole
from .views import send_password_reset


class PersonSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    site = serializers.PrimaryKeyRelatedField(queryset=Site.objects.all(), allow_null=True, required=False)
    farm = serializers.PrimaryKeyRelatedField(queryset=Farm.objects.all(), allow_null=True, required=False)
    site_name = serializers.CharField(source="site.name", default=None, read_only=True)
    farm_name = serializers.CharField(source="farm.name", default=None, read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone", "role", "role_label",
            "status", "status_label", "is_active", "site", "site_name", "farm", "farm_name", "last_login",
        ]
        read_only_fields = ["username", "role", "status", "last_login"]


class PeopleView(APIView):
    """Lists everyone with a portal account. Add ?role=farm or ?q=name to narrow it down (Admins)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        people = User.objects.select_related("site", "farm").order_by("role", "first_name", "last_name")
        role = request.query_params.get("role")
        if role:
            people = people.filter(role=role)
        query = (request.query_params.get("q") or "").strip()
        if query:
            people = people.filter(
                Q(first_name__icontains=query) | Q(last_name__icontains=query)
                | Q(username__icontains=query) | Q(email__icontains=query)
            )
        return Response(
            {
                "people": PersonSerializer(people, many=True).data,
                "sites": [{"id": s.id, "name": s.name} for s in Site.objects.all()],
                "farms": [{"id": f.id, "name": f.name} for f in Farm.objects.all()],
            }
        )


class PersonDetailView(APIView):
    """Changes someone's details, location or farm, or switches their account off or on (Admins)."""

    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        person = get_object_or_404(User, pk=pk)
        if person == request.user and request.data.get("is_active") is False:
            raise ValidationError({"detail": "You can't switch off your own account."})
        serializer = PersonSerializer(person, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(PersonSerializer(person).data)


class SendPasswordResetView(APIView):
    """Emails someone a link to choose a new password (Admins)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        person = get_object_or_404(User, pk=pk)
        if not person.email:
            raise ValidationError({"detail": f"{person.get_full_name() or person.username} has no email address. Add one first."})
        send_password_reset(request, person)
        return Response({"detail": f"We've emailed {person.email} a link to choose a new password."})
