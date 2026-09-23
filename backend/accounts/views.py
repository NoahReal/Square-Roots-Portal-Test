from django.contrib.auth import authenticate, login, logout
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Application, User
from .notifications import notify_person, notify_team
from .permissions import IsAdminRole
from .serializers import ApplicationSerializer, SignupSerializer, UserSerializer


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


@method_decorator(csrf_protect, name="dispatch")
class SignupView(APIView):
    """Signs up a Community Manager, Farm or Host Site from the website. The account waits for admin approval."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user)
        notify_team(
            subject=f"New {user.get_role_display()} sign-up: {user.get_full_name()}",
            body="Someone has signed up on the website. Review it on the Sign-ups screen in the partner portal.",
        )
        return Response(UserSerializer(user).data, status=201)


class ApplicationListView(ListAPIView):
    """Lists website sign-ups for admins. Add ?status=pending, approved or declined to filter."""

    permission_classes = [IsAdminRole]
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        applications = Application.objects.select_related("user", "site", "reviewed_by")
        status = self.request.query_params.get("status")
        if status:
            applications = applications.filter(user__status=status)
        return applications


class _ReviewApplicationView(APIView):
    permission_classes = [IsAdminRole]
    new_status = None

    def post(self, request, pk):
        application = get_object_or_404(Application.objects.select_related("user"), pk=pk)
        user = application.user
        user.status = self.new_status
        if self.new_status == User.Status.APPROVED and application.site:
            user.site = application.site
        user.save()
        application.reviewed_at = timezone.now()
        application.reviewed_by = request.user
        application.save()
        self.tell_applicant(user)
        return Response(ApplicationSerializer(application).data)


class ApproveApplicationView(_ReviewApplicationView):
    """Approves a sign-up, so that person can start using the portal."""

    new_status = User.Status.APPROVED

    def tell_applicant(self, user):
        notify_person(user, "You're approved!", "Welcome to Square Roots. You can now log in to the partner portal.")


class DeclineApplicationView(_ReviewApplicationView):
    """Declines a sign-up. The person can still log in, but only sees a message to contact the team."""

    new_status = User.Status.DECLINED

    def tell_applicant(self, user):
        notify_person(
            user,
            "About your application",
            "Thanks for your interest in Square Roots. We can't approve your application right now. "
            "Reply to this email if you have any questions.",
        )
