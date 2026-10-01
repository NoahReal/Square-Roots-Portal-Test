"""Ordering by the box, the way Square Roots actually buys (see docs/ORDERING-MODEL.md).

Every cycle: suppliers send PRICE LISTS → the team builds an ORDER FORM for each route →
each location fills in a LOCATION ORDER (boxes of each item) → when ordering closes, each supplier
and transport company gets a CONFIRMATION link showing what they need to do.
"""

import secrets
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


def new_token():
    return secrets.token_urlsafe(24)


class PriceList(models.Model):
    """What one supplier has for one cycle, and the price per box. Usually arrives on a Friday."""

    supplier = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="price_lists")
    cycle = models.ForeignKey("drops.DropCycle", on_delete=models.CASCADE, related_name="price_lists")
    received_on = models.DateField(default=timezone.localdate)
    notes = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-cycle__drop_date", "supplier__name"]
        constraints = [models.UniqueConstraint(fields=["supplier", "cycle"], name="one_price_list_per_supplier_per_cycle")]

    def __str__(self):
        return f"{self.supplier} for the {self.cycle}"


class PriceItem(models.Model):
    """One line of a price list, e.g. "Carrots, 50 lb box, $22.00, 40 available"."""

    price_list = models.ForeignKey(PriceList, on_delete=models.CASCADE, related_name="items")
    product = models.CharField(max_length=120)
    box_size = models.CharField(max_length=60, blank=True, help_text="e.g. 50 lb box, case of 24")
    price = models.DecimalField(max_digits=8, decimal_places=2, help_text="Per box")
    available = models.PositiveIntegerField(null=True, blank=True, help_text="Boxes available; blank if no limit given")
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["product"]

    def __str__(self):
        return f"{self.product} ({self.box_size}) ${self.price}"


class OrderForm(models.Model):
    """What locations on one or more routes can order this cycle (Halifax and Halifax North share one).

    Replaces the spreadsheet with a tab per location.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        OPEN = "open", "Open for orders"
        SENT = "sent", "Sent to suppliers"

    cycle = models.ForeignKey("drops.DropCycle", on_delete=models.CASCADE, related_name="order_forms")
    routes = models.ManyToManyField("drops.Route", related_name="order_forms")
    delivery_date = models.DateField(help_text="When the trucks deliver.")
    orders_due = models.DateTimeField(help_text="When locations' orders are due.")
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(blank=True, help_text="Shown to locations at the top of the form.")
    published_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-delivery_date"]

    def __str__(self):
        return f"{' and '.join(r.name for r in self.routes.all())} order form, delivered {self.delivery_date}"

    @property
    def ordering_open(self):
        return self.status == self.Status.OPEN and timezone.now() < self.orders_due


class OrderFormItem(models.Model):
    """Something locations can order on a form. Prices are copied from the price list when it's added,
    so later price list changes don't change what people already ordered."""

    class Deal(models.TextChoices):
        NONE = "", "No note"
        GOOD = "good", "Good deal"
        PRICEY = "pricey", "Pricier than usual"

    form = models.ForeignKey(OrderForm, on_delete=models.CASCADE, related_name="items")
    supplier = models.ForeignKey("farms.Farm", on_delete=models.PROTECT, related_name="+")
    price_item = models.ForeignKey(PriceItem, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    product = models.CharField(max_length=120)
    box_size = models.CharField(max_length=60, blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    available = models.PositiveIntegerField(null=True, blank=True)
    deal = models.CharField(max_length=8, choices=Deal.choices, blank=True, default=Deal.NONE)
    note = models.CharField(max_length=200, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "product"]

    def __str__(self):
        return f"{self.product} on {self.form}"


class LocationOrder(models.Model):
    """One location's order on a form: how many boxes of each item."""

    form = models.ForeignKey(OrderForm, on_delete=models.CASCADE, related_name="location_orders")
    site = models.ForeignKey("drops.Site", on_delete=models.CASCADE, related_name="location_orders")
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["form", "site"], name="one_order_per_site_per_form")]

    def __str__(self):
        return f"{self.site} on {self.form}"


class LocationOrderLine(models.Model):
    order = models.ForeignKey(LocationOrder, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(OrderFormItem, on_delete=models.CASCADE, related_name="lines")
    boxes = models.PositiveIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["order", "item"], name="one_line_per_item")]

    @property
    def cost(self):
        return self.boxes * self.item.price


class TransportCompany(models.Model):
    """A company that drives a route's trucks."""

    name = models.CharField(max_length=150, unique=True)
    contact_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "transport companies"

    def __str__(self):
        return self.name


class Confirmation(models.Model):
    """A supplier's order or a route's transport run, sent with a private link to confirm.

    Replaces the screenshots to farms and the "can you do it?" emails.
    """

    class Kind(models.TextChoices):
        SUPPLIER = "supplier", "Supplier order"
        TRANSPORT = "transport", "Transport run"

    class Status(models.TextChoices):
        WAITING = "waiting", "Waiting"
        CONFIRMED = "confirmed", "Confirmed"
        CANT = "cant", "Can't do it"

    form = models.ForeignKey(OrderForm, on_delete=models.CASCADE, related_name="confirmations")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    supplier = models.ForeignKey("farms.Farm", null=True, blank=True, on_delete=models.CASCADE, related_name="+")
    route = models.ForeignKey("drops.Route", null=True, blank=True, on_delete=models.CASCADE, related_name="+")
    company = models.ForeignKey(TransportCompany, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    token = models.CharField(max_length=40, unique=True, default=new_token)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.WAITING)
    reply = models.CharField(max_length=500, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    replied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["kind", "id"]

    def __str__(self):
        return f"{self.get_kind_display()}: {self.supplier or self.route}"
