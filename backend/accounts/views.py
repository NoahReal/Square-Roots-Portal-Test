from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from drops.models import Site
from farms.models import Farm
from .models import Application, User
from .notifications import notify_person, notify_team
from .permissions import IsAdminRole
from .serializers import AccountSerializer, ApplicationSerializer, SignupSerializer, UserSerializer


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
        return Response({"ok": True, "demo_mode": settings.DEMO_MODE})


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
    """Returns the logged-in user and their role (401 if nobody is logged in). PATCH changes your name, email or phone."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = AccountSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


def check_new_password(password, user):
    try:
        validate_password(password, user)
    except DjangoValidationError as error:
        raise ValidationError({"new_password": " ".join(error.messages)})


class ChangePasswordView(APIView):
    """Changes your own password. You need your current one."""

    def post(self, request):
        if not request.user.check_password(request.data.get("current_password") or ""):
            raise ValidationError({"current_password": "That isn't your current password."})
        new_password = request.data.get("new_password") or ""
        check_new_password(new_password, request.user)
        request.user.set_password(new_password)
        request.user.save()
        update_session_auth_hash(request, request.user)  # stay logged in on this device
        return Response({"ok": True})


def password_link(user, site_url):
    """A one-time link for choosing a new password. It stops working once it's used."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{site_url.rstrip('/')}/portal/reset-password?uid={uid}&token={token}"


def send_password_reset(request, user):
    """Emails a link for choosing a new password."""
    # The link goes to the React page on whatever address the portal is being used at.
    link = password_link(user, f"{request.scheme}://{request.get_host()}")
    notify_person(
        user,
        "Choose a new password",
        f"Hi {user.first_name},\n\nUse this link to choose a new password for the Square Roots partner portal:\n{link}\n\n"
        f"Your username is {user.username}. If you didn't ask for this, you can ignore this email.",
    )


def send_invitation(user, site_url):
    """Welcomes someone added by the team (e.g. by the import command) and asks them to choose a password."""
    notify_person(
        user,
        "Welcome to the Square Roots partner portal",
        f"Hi {user.first_name},\n\nThe Square Roots team has set up your partner portal account.\n"
        f"Your username is {user.username}. Choose your password here:\n{password_link(user, site_url)}\n\n"
        "Then log in at the same address. Questions? Reply to this email.",
    )


@method_decorator(csrf_protect, name="dispatch")
class PasswordResetRequestView(APIView):
    """Emails a password reset link to whoever uses this email address."""

    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip()
        if email:
            for user in User.objects.filter(email__iexact=email, is_active=True):
                send_password_reset(request, user)
        # Same answer either way, so this can't be used to find out who has an account.
        return Response({"detail": "If an account uses that email, we've sent it a link to choose a new password."})


@method_decorator(csrf_protect, name="dispatch")
class PasswordResetConfirmView(APIView):
    """Sets a new password using the link from a password reset email."""

    permission_classes = [AllowAny]

    def post(self, request):
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(request.data.get("uid") or "")))
        except (User.DoesNotExist, ValueError, TypeError):
            user = None
        if user is None or not default_token_generator.check_token(user, request.data.get("token") or ""):
            raise ValidationError({"detail": "This link has expired or has already been used. Ask for a new one."})
        new_password = request.data.get("new_password") or ""
        check_new_password(new_password, user)
        user.set_password(new_password)
        user.save()
        return Response({"ok": True, "username": user.username})


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

    @transaction.atomic
    def post(self, request, pk):
        application = get_object_or_404(Application.objects.select_related("user"), pk=pk)
        user = application.user
        user.status = self.new_status
        if self.new_status == User.Status.APPROVED:
            site = self.location_for(request, application)
            if site:
                application.site = site
                user.site = site
            if user.role == User.Role.FARM and user.farm is None:
                user.farm = Farm.objects.get_or_create(
                    name=application.organization or f"{user.get_full_name()}'s farm",
                    defaults={"location": application.address},
                )[0]
        user.save()
        application.reviewed_at = timezone.now()
        application.reviewed_by = request.user
        if self.new_status == User.Status.DECLINED:
            application.decline_reason = (request.data.get("reason") or "").strip()[:500]
        application.save()
        self.tell_applicant(user, application)
        return Response(ApplicationSerializer(application).data)

    def location_for(self, request, application):
        """Which location an approved Community Manager or Host Site will use.

        The admin can pick an existing one ({"site": 3}) or create one ({"new_site": {"name", "address"}}).
        Without either, we use the one they chose when signing up.
        """
        if application.user.role not in (User.Role.COMMUNITY_MANAGER, User.Role.HOST_SITE):
            return None
        if request.data.get("site"):
            return get_object_or_404(Site, pk=request.data["site"])
        new_site = request.data.get("new_site") or {}
        if new_site.get("name"):
            name = new_site["name"].strip()
            if Site.objects.filter(name__iexact=name).exists():
                raise ValidationError({"new_site": "There's already a location with that name. Choose it from the list instead."})
            if not (new_site.get("address") or "").strip():
                raise ValidationError({"new_site": "Add the new location's address."})
            last = Site.objects.order_by("-sort_order").first()
            return Site.objects.create(
                name=name, address=new_site["address"].strip(), sort_order=(last.sort_order + 1) if last else 0,
                first_drop_pricing=True,  # a brand-new location gets the first-drop incentive
            )
        if application.site:
            return application.site
        raise ValidationError({"site": "Choose which location they'll run, or add a new one."})


class ApproveApplicationView(_ReviewApplicationView):
    """Approves a sign-up. Community Managers and Host Sites need a location: send {"site": id} or {"new_site": {...}}."""

    new_status = User.Status.APPROVED

    def tell_applicant(self, user, application):
        where = f" You'll be running drops at {user.site.name}." if user.site else ""
        notify_person(user, "You're approved!", f"Welcome to Square Roots.{where} You can now log in to the partner portal.")


class DeclineApplicationView(_ReviewApplicationView):
    """Declines a sign-up, with an optional reason for the applicant. They can still log in, but only see a message."""

    new_status = User.Status.DECLINED

    def tell_applicant(self, user, application):
        reason = f"\n\n{application.decline_reason}" if application.decline_reason else ""
        notify_person(
            user,
            "About your application",
            f"Thanks for your interest in Square Roots. We can't approve your application right now.{reason}\n\n"
            "Reply to this email if you have any questions.",
        )
