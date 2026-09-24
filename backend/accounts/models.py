from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """A portal user. Every user has exactly one role, which decides what they can see."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        COMMUNITY_MANAGER = "community_manager", "Community Manager"
        FARM = "farm", "Farm"
        HOST_SITE = "host_site", "Host Site"

    class Status(models.TextChoices):
        # People who sign up on the website start as PENDING until an admin approves them.
        PENDING = "pending", "Waiting for approval"
        APPROVED = "approved", "Approved"
        DECLINED = "declined", "Not approved"

    role = models.CharField(max_length=32, choices=Role.choices, default=Role.COMMUNITY_MANAGER)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.APPROVED)
    phone = models.CharField(max_length=30, blank=True)
    # The location a Community Manager runs, or a Host Site hosts.
    site = models.ForeignKey("drops.Site", null=True, blank=True, on_delete=models.SET_NULL, related_name="people")
    # The farm a Farm-role user works for.
    farm = models.ForeignKey("farms.Farm", null=True, blank=True, on_delete=models.SET_NULL, related_name="people")
    # Set when two-step login is on (see accounts/two_step.py). Blank means password only.
    two_step_secret = models.CharField(max_length=64, blank=True)

    @property
    def is_approved(self):
        return self.status == self.Status.APPROVED

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"


class Application(models.Model):
    """What someone told us when they signed up on the website. One per signed-up user."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="application")

    # Farm name, or the organisation hosting a drop.
    organization = models.CharField(max_length=150, blank=True)
    # Community Managers: an existing location, or a new place they'd like to start one.
    site = models.ForeignKey("drops.Site", null=True, blank=True, on_delete=models.SET_NULL)
    planned_location = models.CharField(max_length=200, blank=True)
    # Host sites and farms: where they are.
    address = models.CharField(max_length=200, blank=True)
    # Farms: the questions from the "Interested?" form on the For Farms page.
    produce_types = models.TextField(blank=True)
    pounds_available = models.CharField(max_length=100, blank=True)
    message = models.TextField(blank=True)

    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    decline_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"Application from {self.user}"
