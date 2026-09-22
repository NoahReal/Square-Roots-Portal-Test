"""Load demo data:  python manage.py seed

Safe to run again: it deletes the demo data first, then recreates it.
Every demo account uses the same password, DEMO_PASSWORD below.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User

DEMO_PASSWORD = "squareroots"

# (username, first name, last name, role)
DEMO_USERS = [
    ("admin", "Maya", "Chen", User.Role.ADMIN),
    ("cm.dartmouth", "Jordan", "MacLeod", User.Role.COMMUNITY_MANAGER),
    ("cm.bedford", "Aisha", "Rahman", User.Role.COMMUNITY_MANAGER),
    ("cm.sackville", "Liam", "Boudreau", User.Role.COMMUNITY_MANAGER),
    ("farm.gaspereau", "Ruth", "Eisenhauer", User.Role.FARM),
    ("farm.canard", "Tom", "Van Dyk", User.Role.FARM),
    ("host.dartmouth", "Grace", "Oickle", User.Role.HOST_SITE),
]


class Command(BaseCommand):
    help = "Delete and recreate the demo data (users, and later sites, farms and drop cycles)."

    @transaction.atomic
    def handle(self, *args, **options):
        User.objects.filter(is_superuser=False).delete()

        for username, first, last, role in DEMO_USERS:
            user = User(username=username, first_name=first, last_name=last, role=role)
            # Admins can also open Django's built-in admin at /django-admin/.
            user.is_staff = role == User.Role.ADMIN
            user.set_password(DEMO_PASSWORD)
            user.save()

        self.stdout.write(self.style.SUCCESS(f"Created {len(DEMO_USERS)} demo users."))
        self.stdout.write(f"Password for every demo user: {DEMO_PASSWORD}")
        for username, first, last, role in DEMO_USERS:
            self.stdout.write(f"  {username:<16} {role.label}")
