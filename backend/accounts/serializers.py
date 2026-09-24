from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from drops.models import Site
from .models import Application, User


class UserSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    site_name = serializers.CharField(source="site.name", default=None, read_only=True)
    farm_name = serializers.CharField(source="farm.name", default=None, read_only=True)
    two_step = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone", "role", "role_label",
            "status", "status_label", "site_name", "farm_name", "two_step",
        ]

    def get_two_step(self, user):
        return bool(user.two_step_secret)


class AccountSerializer(serializers.ModelSerializer):
    """The details people can change about themselves on the My Account page."""

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "phone"]
        extra_kwargs = {
            "first_name": {"required": True, "allow_blank": False, "error_messages": {"blank": "Please add your first name."}},
            "email": {"required": True, "allow_blank": False, "error_messages": {"blank": "Please add your email, so we can reach you."}},
        }


# Which extra fields each kind of sign-up must fill in.
REQUIRED_BY_ROLE = {
    User.Role.COMMUNITY_MANAGER: ["phone"],
    User.Role.FARM: ["organization", "produce_types", "pounds_available"],
    User.Role.HOST_SITE: ["organization", "address", "phone"],
}


class SignupSerializer(serializers.Serializer):
    """Checks a sign-up form from the website and creates a pending account."""

    role = serializers.ChoiceField(choices=list(REQUIRED_BY_ROLE))
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)

    organization = serializers.CharField(max_length=150, required=False, allow_blank=True)
    site = serializers.PrimaryKeyRelatedField(queryset=Site.objects.filter(is_active=True), required=False, allow_null=True)
    planned_location = serializers.CharField(max_length=200, required=False, allow_blank=True)
    address = serializers.CharField(max_length=200, required=False, allow_blank=True)
    produce_types = serializers.CharField(required=False, allow_blank=True)
    pounds_available = serializers.CharField(max_length=100, required=False, allow_blank=True)
    message = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("That username is taken. Please choose another.")
        return value

    def validate_password(self, value):
        # Checked here (not in validate() below) so a weak password is reported
        # at the same time as any other problem with the form.
        person = User(username=self.initial_data.get("username", ""), email=self.initial_data.get("email", ""))
        try:
            validate_password(value, person)
        except DjangoValidationError as error:
            raise serializers.ValidationError(" ".join(error.messages))
        return value

    def validate(self, data):
        errors = {}
        for field in REQUIRED_BY_ROLE[data["role"]]:
            if not str(data.get(field) or "").strip():
                errors[field] = "Please fill this in."

        if data["role"] == User.Role.COMMUNITY_MANAGER and not data.get("site") and not data.get("planned_location", "").strip():
            errors["planned_location"] = "Choose a location, or tell us where you'd like to start one."

        if errors:
            raise serializers.ValidationError(errors)
        return data

    def create(self, data):
        user = User(
            username=data["username"],
            first_name=data["first_name"].strip(),
            last_name=data["last_name"].strip(),
            email=data["email"],
            phone=data.get("phone", "").strip(),
            role=data["role"],
            status=User.Status.PENDING,
        )
        user.set_password(data["password"])
        user.save()
        Application.objects.create(
            user=user,
            organization=data.get("organization", "").strip(),
            site=data.get("site"),
            planned_location=data.get("planned_location", "").strip(),
            address=data.get("address", "").strip(),
            produce_types=data.get("produce_types", "").strip(),
            pounds_available=data.get("pounds_available", "").strip(),
            message=data.get("message", "").strip(),
        )
        return user


class ApplicationSerializer(serializers.ModelSerializer):
    """A sign-up, as the admin Sign-ups screen shows it."""

    user = UserSerializer(read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    site_name = serializers.CharField(source="site.name", default=None, read_only=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.get_full_name", default=None, read_only=True)

    class Meta:
        model = Application
        fields = [
            "id", "user", "email", "phone", "organization", "site_name", "planned_location", "address",
            "produce_types", "pounds_available", "message", "submitted_at", "reviewed_at", "reviewed_by_name",
            "decline_reason",
        ]
