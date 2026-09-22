from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import UserSerializer


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """The React app calls this first so the browser gets a CSRF cookie."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"ok": True})


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user = authenticate(
            request,
            username=request.data.get("username", "").strip(),
            password=request.data.get("password", ""),
        )
        if user is None:
            return Response({"detail": "That username and password don't match."}, status=400)
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"ok": True})


class MeView(APIView):
    """Who is logged in? Returns 403 if nobody is."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)
