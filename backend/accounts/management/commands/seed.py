"""Load demo data:  python manage.py seed

Safe to run again: it deletes the demo data first, then recreates it.
Every demo account uses the same password, DEMO_PASSWORD below.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import Application, User
from drops.models import Site
from website.models import ContactMessage

DEMO_PASSWORD = "squareroots"

# The 11 real Square Roots locations, as listed on squarerootssmu.ca/drop-dates-locations.
# (name, address, instagram, facebook, highlight)
SITES = [
    ("Fairview / Clayton Park", "50 Gesner St", "https://www.instagram.com/squareroots.fcp/", "https://www.facebook.com/squarerootsfvcp", ""),
    ("Upper Tantallon", "5374 St Margarets Bay Rd", "", "", ""),
    ("Halifax - South End", "5596 Morris St", "https://www.instagram.com/squarerootshalifaxsouth/", "", ""),
    ("Windsor", "613 King St", "", "", ""),
    ("East Dartmouth", "50 Caledonia Rd", "", "", ""),
    ("New Glasgow", "345 Temperance St", "https://www.instagram.com/squareroots.ng", "", "Our newest location, in the heart of Pictou County."),
    ("Lower Sackville", "636 Sackville Dr", "https://www.instagram.com/squarerootssackville", "https://www.facebook.com/SquareRootsSackville", ""),
    ("Halifax - North End", "5522 Russell St", "https://www.instagram.com/squareroots.northend/", "", ""),
    ("Middle Musquodoboit", "13867 Hwy 224", "", "", ""),
    ("Dartmouth", "105 Highfield Park Dr", "", "", ""),
    ("Cole Harbour", "15 Bissett Rd", "https://www.instagram.com/coleharbourfridge/", "https://www.facebook.com/profile.php?id=61555331890264", ""),
]

# Approved accounts: (username, first name, last name, role, site name or None)
DEMO_USERS = [
    ("admin", "Maya", "Chen", User.Role.ADMIN, None),
    ("cm.dartmouth", "Jordan", "MacLeod", User.Role.COMMUNITY_MANAGER, "Dartmouth"),
    ("cm.northend", "Aisha", "Rahman", User.Role.COMMUNITY_MANAGER, "Halifax - North End"),
    ("cm.sackville", "Liam", "Boudreau", User.Role.COMMUNITY_MANAGER, "Lower Sackville"),
    ("farm.gaspereau", "Ruth", "Eisenhauer", User.Role.FARM, None),
    ("farm.canard", "Tom", "Van Dyk", User.Role.FARM, None),
    ("host.fairview", "Grace", "Oickle", User.Role.HOST_SITE, "Fairview / Clayton Park"),
]

# People who signed up on the website and are waiting for an admin to review them.
PENDING_SIGNUPS = [
    {
        "user": ("apply.bedford", "Priya", "Nair", User.Role.COMMUNITY_MANAGER, "priya.nair@example.com", "902-555-0141"),
        "application": {
            "planned_location": "Bedford, near the library",
            "message": "I run a weekly community lunch and lots of our regulars would love affordable produce.",
        },
    },
    {
        "user": ("apply.northmountain", "Sam", "Porter", User.Role.FARM, "sam@northmountaingarden.example", "902-555-0178"),
        "application": {
            "organization": "North Mountain Market Garden",
            "address": "Kings County, Annapolis Valley",
            "produce_types": "Carrots, beets, potatoes, winter squash",
            "pounds_available": "About 300 lbs every two weeks in the fall",
        },
    },
    {
        "user": ("apply.windsorhall", "Dana", "Whynot", User.Role.HOST_SITE, "dana.whynot@example.com", "902-555-0112"),
        "application": {
            "organization": "Windsor Community Hall",
            "site": "Windsor",
            "address": "613 King St, Windsor",
            "message": "We'd be happy to keep hosting the Windsor drops in our hall.",
        },
    },
]


class Command(BaseCommand):
    help = "Delete and recreate the demo data: locations, users and sample sign-ups."

    @transaction.atomic
    def handle(self, *args, **options):
        User.objects.filter(is_superuser=False).delete()  # also deletes their applications
        Site.objects.all().delete()
        ContactMessage.objects.all().delete()

        sites = {}
        for order, (name, address, instagram, facebook, highlight) in enumerate(SITES):
            sites[name] = Site.objects.create(
                name=name, address=address, instagram_url=instagram, facebook_url=facebook,
                highlight=highlight, sort_order=order,
            )

        for username, first, last, role, site_name in DEMO_USERS:
            user = User(username=username, first_name=first, last_name=last, role=role, site=sites.get(site_name))
            # Admins can also open Django's built-in admin at /django-admin/.
            user.is_staff = role == User.Role.ADMIN
            user.set_password(DEMO_PASSWORD)
            user.save()

        for signup in PENDING_SIGNUPS:
            username, first, last, role, email, phone = signup["user"]
            user = User(
                username=username, first_name=first, last_name=last, role=role,
                email=email, phone=phone, status=User.Status.PENDING,
            )
            user.set_password(DEMO_PASSWORD)
            user.save()
            details = dict(signup["application"])
            if "site" in details:
                details["site"] = sites[details["site"]]
            Application.objects.create(user=user, **details)

        self.stdout.write(self.style.SUCCESS(
            f"Created {len(SITES)} locations, {len(DEMO_USERS)} demo users and {len(PENDING_SIGNUPS)} pending sign-ups."
        ))
        self.stdout.write(f"Password for every demo user: {DEMO_PASSWORD}")
        for username, first, last, role, site_name in DEMO_USERS:
            self.stdout.write(f"  {username:<20} {role.label}" + (f" ({site_name})" if site_name else ""))
        for signup in PENDING_SIGNUPS:
            username, first, last, role, *_ = signup["user"]
            self.stdout.write(f"  {username:<20} {role.label}, waiting for approval")
