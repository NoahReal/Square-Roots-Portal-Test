import secrets
from datetime import time
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

# Every Square Roots bundle is 10 lbs of produce.
BUNDLE_POUNDS = 10


class OperatingSettings(models.Model):
    """Prices and logistics the Square Roots team sets on the admin Settings screen. There's only ever one row."""

    standard_price = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("10.00"),
        help_text="Standard / pay-it-forward price for a 10 lb bundle.",
    )
    at_cost_price = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("7.50"),
        help_text="At-cost price for people who can't afford the standard price. "
        "It's also what a Community Manager owes Square Roots for each paid bundle.",
    )
    first_drop_cost = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("3.75"),
        help_text="What a new location owes Square Roots per paid bundle at its very first drop (the first-drop incentive).",
    )
    delivery_fee = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("1.99"), help_text="Home delivery fee, where delivery is offered.",
    )
    staging_location = models.CharField(
        max_length=200, blank=True, help_text="Where farm produce is dropped off and sorted into bundles.",
    )

    class Meta:
        verbose_name_plural = "operating settings"

    def __str__(self):
        return "Operating settings"

    @classmethod
    def current(cls):
        return cls.objects.get_or_create(pk=1)[0]

    @property
    def manager_share(self):
        """What a Community Manager keeps from each standard bundle: $10.00 - $7.50 = $2.50."""
        return self.standard_price - self.at_cost_price


class Site(models.Model):
    """A Square Roots location, where a Community Manager runs drops (e.g. "Lower Sackville")."""

    name = models.CharField(max_length=100, unique=True)
    address = models.CharField(max_length=200)
    instagram_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    highlight = models.CharField(max_length=200, blank=True, help_text="Shown under Location Highlights on the public site.")
    # Blank if this location has no home delivery.
    delivery_partner = models.CharField(max_length=100, blank=True, help_text="Who does home delivery here, e.g. BayRides.")
    # New locations get the first-drop incentive on their first drop. Locations that were running
    # before they were added to the portal shouldn't, so this is off unless the team turns it on.
    first_drop_pricing = models.BooleanField(
        default=False, help_text="Charge the first-drop price at this location's first drop (for brand-new locations)."
    )
    # Customers can reserve bundles on the website when this is on.
    online_reservations = models.BooleanField(
        default=False, help_text="Let customers reserve bundles for this location on the website."
    )
    reservation_limit = models.PositiveIntegerField(
        default=20,
        help_text="Bundles set aside for reservations at each drop, online and through the Community Manager. "
        "When they're gone, customers can join a waitlist.",
    )
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
    # When the "ordering closes soon" reminder went to the Community Manager (see send_reminders).
    order_reminder_sent_at = models.DateTimeField(null=True, blank=True)

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


# Pickup codes use letters and numbers that are hard to mix up (no O and 0, no I and 1).
PICKUP_CODE_CHARACTERS = "ACDEFHJKMNPRTUVWXY34679"


def new_manage_token():
    """The secret part of a customer's "change or cancel your reservation" link."""
    return secrets.token_urlsafe(24)


class Language(models.TextChoices):
    """Languages customers can use the Reserve pages and get their emails in."""

    ENGLISH = "en", "English"
    FRENCH = "fr", "Français"


class PriceTier(models.TextChoices):
    """The sliding scale: customers choose what works for them, no questions asked."""

    STANDARD = "standard", "Standard"
    AT_COST = "at_cost", "At cost"
    FREE = "free", "Free"


class StandingReservation(models.Model):
    """A customer who asked to reserve at every drop at their location ("reserve every drop").

    Each time a new drop is scheduled there, a reservation is made for them automatically
    (or a waitlist spot, if it's full) and they're emailed. Stopping deletes this.
    """

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="standing_reservations")
    customer_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    bundles = models.PositiveSmallIntegerField(default=1)
    price_tier = models.CharField(max_length=16, choices=PriceTier.choices, default=PriceTier.STANDARD)
    pay_it_forward = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    delivery = models.BooleanField(default=False)
    delivery_address = models.CharField(max_length=200, blank=True)
    language = models.CharField(max_length=5, choices=Language.choices, default=Language.ENGLISH)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.customer_name} reserves {self.bundles} at every {self.site} drop"


class Preorder(models.Model):
    """A customer who reserved bundles at a drop, online or through their Community Manager."""

    PriceTier = PriceTier

    class Source(models.TextChoices):
        MANAGER = "manager", "Added by the Community Manager"
        ONLINE = "online", "Reserved online"
        HOST = "host", "Reserved by the host site"

    site_drop = models.ForeignKey(SiteDrop, on_delete=models.CASCADE, related_name="preorders")
    customer_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    bundles = models.PositiveSmallIntegerField(default=1)
    price_tier = models.CharField(max_length=16, choices=PriceTier.choices, default=PriceTier.STANDARD)
    delivery = models.BooleanField(default=False, help_text="Home delivery instead of picking up at the drop.")
    delivery_address = models.CharField(max_length=200, blank=True)
    # An optional gift on top of the bundle price, paid at the drop, to help cover free bundles.
    pay_it_forward = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    # Set when this was made automatically from a "reserve every drop" request.
    standing = models.ForeignKey(StandingReservation, null=True, blank=True, on_delete=models.SET_NULL, related_name="preorders")
    # Set when a host site reserved on someone's behalf (e.g. a community centre for a client).
    reserved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reservations_made"
    )
    language = models.CharField(max_length=5, choices=Language.choices, default=Language.ENGLISH)
    paid = models.BooleanField(default=False)
    picked_up = models.BooleanField(default=False)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.MANAGER)
    # A short code the customer shows at the drop, e.g. "K7M4". Unique within the drop.
    pickup_code = models.CharField(max_length=4, blank=True)
    # Only for online reservations: the secret in the customer's "change or cancel" link.
    manage_token = models.CharField(max_length=40, blank=True, db_index=True)
    # When the "see you tomorrow" reminder was emailed (see send_reminders).
    reminder_sent_at = models.DateTimeField(null=True, blank=True)

    class Feedback(models.TextChoices):
        GOOD = "good", "Great"
        OKAY = "okay", "Okay"
        POOR = "poor", "Not great"

    # "How was your bundle?", asked by email the day after the drop.
    feedback_asked_at = models.DateTimeField(null=True, blank=True)
    feedback = models.CharField(max_length=8, choices=Feedback.choices, blank=True)
    feedback_comment = models.CharField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["customer_name"]

    def __str__(self):
        return f"{self.customer_name} ({self.bundles})"

    def save(self, *args, **kwargs):
        if not self.pickup_code:
            taken = set(Preorder.objects.filter(site_drop=self.site_drop_id).values_list("pickup_code", flat=True))
            while not self.pickup_code or self.pickup_code in taken:
                self.pickup_code = "".join(secrets.choice(PICKUP_CODE_CHARACTERS) for _ in range(4))
        super().save(*args, **kwargs)


class WaitlistEntry(models.Model):
    """Someone waiting for a bundle at a drop whose reservations are all taken.

    When a reservation is cancelled, the first person in line whose request fits
    gets a reservation automatically (see drops/reservations.py).
    """

    site_drop = models.ForeignKey(SiteDrop, on_delete=models.CASCADE, related_name="waitlist")
    customer_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    bundles = models.PositiveSmallIntegerField(default=1)
    price_tier = models.CharField(max_length=16, choices=PriceTier.choices, default=PriceTier.STANDARD)
    delivery = models.BooleanField(default=False)
    delivery_address = models.CharField(max_length=200, blank=True)
    pay_it_forward = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    standing = models.ForeignKey(StandingReservation, null=True, blank=True, on_delete=models.SET_NULL, related_name="waitlist_entries")
    language = models.CharField(max_length=5, choices=Language.choices, default=Language.ENGLISH)
    manage_token = models.CharField(max_length=40, db_index=True, default=new_manage_token)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name_plural = "waitlist entries"

    def __str__(self):
        return f"{self.customer_name} waiting for {self.bundles} at {self.site_drop}"


class DropReport(models.Model):
    """What happened at a drop, logged by the Community Manager afterwards."""

    class Leftovers(models.TextChoices):
        NONE = "none", "Nothing left over"
        DONATED = "donated", "Donated"
        KEPT = "kept", "Kept for the next drop"
        COMPOSTED = "composted", "Composted"
        OTHER = "other", "Something else"

    site_drop = models.OneToOneField(SiteDrop, on_delete=models.CASCADE, related_name="report")
    # Sliding-scale pricing: how many bundles went at each price.
    bundles_standard = models.PositiveIntegerField(default=0)
    bundles_at_cost = models.PositiveIntegerField(default=0)
    bundles_free = models.PositiveIntegerField(default=0)
    # The total of the three above; kept up to date in save().
    bundles_sold = models.PositiveIntegerField(default=0)
    donations = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    # When the Community Manager's payment to Square Roots for this drop arrived.
    remittance_received_on = models.DateField(null=True, blank=True)
    bundles_left_over = models.PositiveIntegerField(default=0)
    leftovers_went_to = models.CharField(max_length=16, choices=Leftovers.choices, default=Leftovers.NONE)
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Report for {self.site_drop}"

    def save(self, *args, **kwargs):
        self.bundles_sold = self.bundles_standard + self.bundles_at_cost + self.bundles_free
        super().save(*args, **kwargs)
