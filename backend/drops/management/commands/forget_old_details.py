"""Removes customers' personal details once they're no longer needed (see the Privacy page).

Run it once a day, for example with cron:  python manage.py forget_old_details
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from drops.models import Preorder, WaitlistEntry
from website.models import ContactMessage

REMOVED = "Customer (details removed)"


class Command(BaseCommand):
    help = "Remove customers' names and contact details some time after their drop, and delete old contact messages."

    def handle(self, *args, **options):
        today = timezone.localdate()
        drops_before = today - timedelta(days=settings.CUSTOMER_DETAILS_KEPT_DAYS)

        # Reservations: keep the numbers (bundles, price, paid) for the drop's records, remove who it was.
        reservations = Preorder.objects.filter(site_drop__drop_date__lt=drops_before).exclude(customer_name=REMOVED)
        forgotten = reservations.update(
            customer_name=REMOVED, email="", phone="", delivery_address="", manage_token="", standing=None
        )
        # Waitlist spots for drops that have happened are no use to anyone.
        waitlist, _ = WaitlistEntry.objects.filter(site_drop__drop_date__lt=today).delete()
        messages, _ = ContactMessage.objects.filter(
            created_at__lt=timezone.now() - timedelta(days=settings.CONTACT_MESSAGES_KEPT_DAYS)
        ).delete()

        self.stdout.write(
            f"Removed details from {forgotten} reservations, {waitlist} old waitlist spots "
            f"and {messages} old contact messages."
        )
