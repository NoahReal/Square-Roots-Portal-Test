from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .permissions import IsAdminRole
from .serializers import UserSerializer


def check_credentials(request, username, password):
    """The one place a username and password get checked.

    Returns (user, None) if they're right, or (None, reason) if not.
    The login page and the admin login tester both use this, so testing
    one tests the other.
    """
    username = (username or "").strip()
    if not username or not password:
        return None, "Username and password are both required."

    user = authenticate(request, username=username, password=password)
    if user is not None:
        return user, None

    # Work out why, for the admin login tester. The login page never shows
    # this detail, so it can't be used to discover which usernames exist.
    existing = User.objects.filter(username=username).first()
    if existing is None:
        return None, "No account has that username."
    if not existing.is_active:
        return None, "This account has been switched off."
    return None, "The password is wrong."


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Gives the browser a CSRF cookie. The React app calls this once when it loads."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"ok": True})


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    """Logs in with a username and password, and returns who you are."""

    permission_classes = [AllowAny]

    def post(self, request):
        user, _reason = check_credentials(request, request.data.get("username"), request.data.get("password"))
        if user is None:
            return Response({"detail": "That username and password don't match."}, status=400)
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    """Logs out the current user."""

    def post(self, request):
        logout(request)
        return Response({"ok": True})


class MeView(APIView):
    """Returns the logged-in user and their role. Returns 403 if nobody is logged in."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class CheckLoginView(APIView):
    """Admin tool: checks a username and password the same way the login page does,
    without logging anyone in or out. Says why a login would fail."""

    permission_classes = [IsAdminRole]

    def post(self, request):
        user, reason = check_credentials(request, request.data.get("username"), request.data.get("password"))
        return Response(
            {
                "valid": user is not None,
                "reason": reason,
                "user": UserSerializer(user).data if user else None,
            }
        )
