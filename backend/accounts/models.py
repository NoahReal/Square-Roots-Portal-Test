from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """A portal user. Every user has exactly one role, which decides what they can see."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        COMMUNITY_MANAGER = "community_manager", "Community Manager"
        FARM = "farm", "Farm"
        HOST_SITE = "host_site", "Host Site"

    role = models.CharField(max_length=32, choices=Role.choices, default=Role.COMMUNITY_MANAGER)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"
