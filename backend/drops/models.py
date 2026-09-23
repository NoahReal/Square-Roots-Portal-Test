from datetime import time

from django.conf import settings
from django.db import models
from django.utils import timezone

# Every Square Roots bundle is 10 lbs of produce.
BUNDLE_POUNDS = 10


class Site(models.Model):
    """A Square Roots location, where a Community Manager runs drops (e.g. "Lower Sackville")."""

    name = models.CharField(max_length=100, unique=True)
    address = models.CharField(max_length=200)
    instagram_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    highlight = models.CharField(max_length=200, blank=True, help_text="Shown under Location Highlights on the public site.")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class DropCycle(models.Model):
    """One round of ordering and drops, roughly every two weeks (e.g. "October 10 drop").

    The cycle's date and cutoff are the defaults; each site's SiteDrop can differ.
    """

    name = models.CharField(max_length=100)
    drop_date = models.DateField()
    order_cutoff = models.DateTimeField(help_text="Community Managers must order by this time.")

    class Meta:
        ordering = ["-drop_date"]

    def __str__(self):
        return self.name


class SiteDrop(models.Model):
    """One location's drop in a cycle: when it happens and when its order is due."""

    cycle = models.ForeignKey(DropCycle, on_delete=models.CASCADE, related_name="site_drops")
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="drops")
    drop_date = models.DateField()
    order_cutoff = models.DateTimeField()
    starts_at = models.TimeField(default=time(11))
    ends_at = models.TimeField(default=time(13))

    class Meta:
        ordering = ["drop_date", "site__sort_order"]
        constraints = [models.UniqueConstraint(fields=["cycle", "site"], name="one_drop_per_site_per_cycle")]

    def __str__(self):
        return f"{self.site} on {self.drop_date}"

    @property
    def ordering_open(self):
        return timezone.now() < self.order_cutoff

    @property
    def has_happened(self):
        return self.drop_date <= timezone.localdate()


class BundleOrder(models.Model):
    """How many bundles a Community Manager ordered for their site's drop."""

    site_drop = models.OneToOneField(SiteDrop, on_delete=models.CASCADE, related_name="order")
    bundles = models.PositiveIntegerField()
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"{self.bundles} bundles for {self.site_drop}"


class Preorder(models.Model):
    """A customer who reserved bundles at a drop. Community Managers keep this list."""

    site_drop = models.ForeignKey(SiteDrop, on_delete=models.CASCADE, related_name="preorders")
    customer_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=30, blank=True)
    bundles = models.PositiveSmallIntegerField(default=1)
    paid = models.BooleanField(default=False)
    picked_up = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["customer_name"]

    def __str__(self):
        return f"{self.customer_name} ({self.bundles})"


class DropReport(models.Model):
    """What happened at a drop, logged by the Community Manager afterwards."""

    class Leftovers(models.TextChoices):
        NONE = "none", "Nothing left over"
        DONATED = "donated", "Donated"
        KEPT = "kept", "Kept for the next drop"
        COMPOSTED = "composted", "Composted"
        OTHER = "other", "Something else"

    site_drop = models.OneToOneField(SiteDrop, on_delete=models.CASCADE, related_name="report")
    bundles_sold = models.PositiveIntegerField()
    bundles_left_over = models.PositiveIntegerField(default=0)
    leftovers_went_to = models.CharField(max_length=16, choices=Leftovers.choices, default=Leftovers.NONE)
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Report for {self.site_drop}"
