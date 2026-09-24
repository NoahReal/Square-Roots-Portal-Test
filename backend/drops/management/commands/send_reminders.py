"""Sends reminder emails. Safe to run as often as you like: each reminder goes out only once.

Run it every hour, for example with cron:  python manage.py send_reminders --site-url https://your.site
  - Customers: the day before their drop (from 9 a.m.), with their pickup code.
  - Community Managers: when ordering closes within a day and they haven't ordered yet.
  - Customers: "How was your bundle?" the day after their drop (from 9 a.m.).
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from accounts.notifications import friendly_time, notify_person
from drops import customer_emails
from drops.models import Preorder, SiteDrop
from drops.reservations import amount_due

# Customers' reminders go out from this hour (Halifax time) the day before their drop.
REMINDER_HOUR = 9


class Command(BaseCommand):
    help = "Email customers the day before their drop, and Community Managers who haven't ordered before the cutoff."

    def add_arguments(self, parser):
        parser.add_argument(
            "--site-url", default="http://localhost:5173",
            help="The website's address, for the links in the emails (e.g. https://squarerootssmu.ca).",
        )

    def handle(self, *args, site_url, **options):
        now = timezone.localtime()
        customers = self.remind_customers(now, site_url) if now.hour >= REMINDER_HOUR else 0
        asked = self.ask_for_feedback(now, site_url) if now.hour >= REMINDER_HOUR else 0
        managers = self.remind_managers(now)
        self.stdout.write(
            f"Reminded {customers} customers and {managers} Community Managers, and asked {asked} customers for feedback."
        )

    def remind_customers(self, now, site_url):
        tomorrow = now.date() + timedelta(days=1)
        due = Preorder.objects.filter(
            site_drop__drop_date=tomorrow, reminder_sent_at__isnull=True, picked_up=False
        ).exclude(email="").select_related("site_drop__site")
        sent = 0
        for preorder in due:
            customer_emails.reminder(preorder, site_url, amount_due(preorder))
            preorder.reminder_sent_at = now
            preorder.save(update_fields=["reminder_sent_at"])
            sent += 1
        return sent

    def ask_for_feedback(self, now, site_url):
        # Up to three days after the drop, so a missed day of reminders doesn't skip anyone.
        recent = Preorder.objects.filter(
            site_drop__drop_date__lt=now.date(), site_drop__drop_date__gte=now.date() - timedelta(days=3),
            feedback_asked_at__isnull=True, feedback="",
        ).exclude(email="").exclude(manage_token="").select_related("site_drop__site")
        asked = 0
        for preorder in recent:
            customer_emails.feedback_request(preorder, site_url)
            preorder.feedback_asked_at = now
            preorder.save(update_fields=["feedback_asked_at"])
            asked += 1
        return asked

    def remind_managers(self, now):
        closing_soon = SiteDrop.objects.filter(
            order_cutoff__gt=now, order_cutoff__lte=now + timedelta(hours=24),
            order__isnull=True, order_reminder_sent_at__isnull=True,
        ).select_related("site", "cycle")
        sent = 0
        for site_drop in closing_soon:
            reserved = sum(p.bundles for p in site_drop.preorders.all())
            managers = site_drop.site.people.filter(role=User.Role.COMMUNITY_MANAGER, status=User.Status.APPROVED)
            for manager in managers:
                notify_person(
                    manager,
                    f"Ordering for the {site_drop.cycle.name} closes soon",
                    f"Hi {manager.first_name},\n\nYou haven't ordered bundles for {site_drop.site.name} yet. "
                    f"Ordering closes {friendly_time(site_drop.order_cutoff)}.\n\n"
                    + (f"Customers have reserved {reserved} bundles so far.\n\n" if reserved else "")
                    + "Order on the Order screen in the partner portal.",
                )
                sent += 1
            site_drop.order_reminder_sent_at = now
            site_drop.save(update_fields=["order_reminder_sent_at"])
        return sent
