from decimal import Decimal

from django.db import models
from django.utils import timezone


class Farm(models.Model):
    """A farm that sells seconds produce to Square Roots. Farm-role users belong to one."""

    name = models.CharField(max_length=150, unique=True)
    location = models.CharField(max_length=200, blank=True, help_text="Town or county, e.g. Canard, Kings County")
    pickup_notes = models.CharField(max_length=300, blank=True, help_text="Copied onto each new order from this farm.")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ProduceListing(models.Model):
    """Seconds produce a farm has posted as available (the farm's Produce screen)."""

    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="listings")
    produce = models.CharField(max_length=100, help_text="e.g. Carrots")
    pounds = models.PositiveIntegerField()
    price_per_pound = models.DecimalField(max_digits=6, decimal_places=2)
    available_until = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=300, blank=True)
    # "Sold out" hides a listing from the farm's list but keeps it for the team's records.
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.produce}, {self.pounds} lbs ({self.farm})"


class FarmOrder(models.Model):
    """What Square Roots is buying from one farm for one drop cycle, and when it's picked up."""

    class Status(models.TextChoices):
        WAITING = "waiting", "Waiting for farm"
        CONFIRMED = "confirmed", "Confirmed"
        CANT_FILL = "cant_fill", "Farm can't fill"

    class Payment(models.TextChoices):
        # Payments aren't real in this prototype; the team marks orders paid in the Django admin.
        NOT_PAID = "not_paid", "Not paid yet"
        PAID = "paid", "Paid"

    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="orders")
    drop_cycle = models.ForeignKey("drops.DropCycle", on_delete=models.PROTECT, related_name="farm_orders")
    pickup_at = models.DateTimeField()
    pickup_notes = models.CharField(max_length=300, blank=True, help_text="e.g. Square Roots van at the farm stand")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.WAITING)
    farm_note = models.CharField(max_length=500, blank=True, help_text="The farm's reason if it can't fill the order.")
    responded_at = models.DateTimeField(null=True, blank=True)
    # Orders are drafts (farms can't see them) until the team sends them, after ordering closes.
    sent_at = models.DateTimeField(null=True, blank=True)
    payment = models.CharField(max_length=16, choices=Payment.choices, default=Payment.NOT_PAID)
    paid_on = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["pickup_at"]

    def __str__(self):
        return f"{self.farm} for {self.drop_cycle}"

    def save(self, *args, **kwargs):
        # Marking an order paid (e.g. in the Django admin) records the date automatically.
        if self.payment == self.Payment.PAID and not self.paid_on:
            self.paid_on = timezone.localdate()
        super().save(*args, **kwargs)

    @property
    def total(self):
        return sum((line.total for line in self.lines.all()), Decimal("0.00"))


class FarmOrderLine(models.Model):
    """One item in a farm order, e.g. 400 lbs of carrots at $0.35/lb."""

    order = models.ForeignKey(FarmOrder, on_delete=models.CASCADE, related_name="lines")
    # The produce listing this was bought from, so removing the line can give the pounds back.
    listing = models.ForeignKey(ProduceListing, null=True, blank=True, on_delete=models.SET_NULL, related_name="order_lines")
    produce = models.CharField(max_length=100)
    pounds = models.PositiveIntegerField()
    price_per_pound = models.DecimalField(max_digits=6, decimal_places=2)

    def __str__(self):
        return f"{self.pounds} lbs {self.produce}"

    @property
    def total(self):
        return self.pounds * self.price_per_pound
