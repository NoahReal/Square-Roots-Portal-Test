from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.notifications import notify_team
from .models import ContactMessage


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
