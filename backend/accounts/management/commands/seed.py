"""Load demo data:  python manage.py seed

Safe to run again: it deletes the demo data first, then recreates it.
Every demo account uses the same password, DEMO_PASSWORD below.
"""

from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Application, User
from drops.models import DropCycle, Site
from farms.models import Farm, FarmOrder, FarmOrderLine, ProduceListing
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

# Fictional farms. (name, location, pickup notes, demo username)
FARMS = [
    ("Gaspereau Valley Growers", "Gaspereau, Kings County", "Square Roots van picks up at the farm stand.", "farm.gaspereau"),
    ("Canard Creek Farm", "Canard, Kings County", "Load from the cold storage barn. Please bring your own bins.", "farm.canard"),
]

# Produce each farm has posted: (produce, lbs, $/lb, days until it's gone, notes)
LISTINGS = {
    "Gaspereau Valley Growers": [
        ("Carrots", 600, "0.35", 18, "Some are forked or twisted. All good eating."),
        ("Yukon Gold potatoes", 800, "0.30", 25, "Mixed sizes, a few with green shoulders trimmed."),
        ("Butternut squash", 250, "0.50", 40, "Scarred skins from wind rub."),
        ("Beets", 150, "0.45", 12, ""),
    ],
    "Canard Creek Farm": [
        ("Green cabbage", 400, "0.40", 20, "Outer leaves a bit rough."),
        ("Yellow onions", 500, "0.40", 45, "Small and oddly shaped."),
    ],
}

# Farm orders, by drop cycle. The cycle number counts from the next drop:
# -2 and -1 are past drops, 0 is this weekend, 1 is two weeks out.
# (farm, cycle, status, paid?, farm note, [(produce, lbs, $/lb), ...])
FARM_ORDERS = [
    ("Gaspereau Valley Growers", -2, FarmOrder.Status.CONFIRMED, True, "", [("Carrots", 350, "0.35"), ("Yukon Gold potatoes", 500, "0.30")]),
    ("Gaspereau Valley Growers", -1, FarmOrder.Status.CONFIRMED, True, "", [("Apples (Cortland seconds)", 300, "0.55"), ("Yellow onions", 200, "0.40")]),
    ("Gaspereau Valley Growers", 0, FarmOrder.Status.CONFIRMED, False, "", [("Carrots", 400, "0.35"), ("Beets", 150, "0.45")]),
    ("Gaspereau Valley Growers", 1, FarmOrder.Status.WAITING, False, "", [("Carrots", 300, "0.35"), ("Yukon Gold potatoes", 400, "0.30"), ("Butternut squash", 200, "0.50")]),
    ("Canard Creek Farm", -2, FarmOrder.Status.CANT_FILL, False, "Hail damage last week, nothing to spare. Sorry!", [("Green cabbage", 250, "0.40")]),
    ("Canard Creek Farm", -1, FarmOrder.Status.CONFIRMED, True, "", [("Green cabbage", 250, "0.40")]),
    ("Canard Creek Farm", 0, FarmOrder.Status.WAITING, False, "", [("Yellow onions", 300, "0.40"), ("Green cabbage", 200, "0.40")]),
]


def at(day, hour):
    """A time on a given date, in the portal's time zone (Halifax)."""
    return timezone.make_aware(datetime.combine(day, time(hour)))


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
    help = "Delete and recreate the demo data: locations, farms, drop cycles, farm orders, users and sample sign-ups."

    @transaction.atomic
    def handle(self, *args, **options):
        User.objects.filter(is_superuser=False).delete()  # also deletes their applications
        FarmOrder.objects.all().delete()
        Farm.objects.all().delete()  # also deletes their produce listings
        DropCycle.objects.all().delete()
        Site.objects.all().delete()
        ContactMessage.objects.all().delete()

        sites = {}
        for order, (name, address, instagram, facebook, highlight) in enumerate(SITES):
            sites[name] = Site.objects.create(
                name=name, address=address, instagram_url=instagram, facebook_url=facebook,
                highlight=highlight, sort_order=order,
            )

        today = timezone.localdate()
        farms = {}
        farm_for_user = {}
        for name, location, _notes, username in FARMS:
            farms[name] = Farm.objects.create(name=name, location=location)
            farm_for_user[username] = farms[name]
            for produce, pounds, price, days_left, notes in LISTINGS[name]:
                ProduceListing.objects.create(
                    farm=farms[name], produce=produce, pounds=pounds, price_per_pound=Decimal(price),
                    available_until=today + timedelta(days=days_left), notes=notes,
                )

        # Drops are every second Saturday. Cycle 0 is the next Saturday.
        next_saturday = today + timedelta(days=(5 - today.weekday()) % 7)
        cycles = {}
        for number in (-2, -1, 0, 1):
            drop_date = next_saturday + timedelta(weeks=2 * number)
            cycles[number] = DropCycle.objects.create(
                name=f"{drop_date:%B} {drop_date.day} drop",
                drop_date=drop_date,
                order_cutoff=at(drop_date - timedelta(days=4), 17),  # Tuesday at 5 pm
            )

        pickup_notes = {name: notes for name, _location, notes, _username in FARMS}
        for farm_name, number, status, paid, note, lines in FARM_ORDERS:
            cycle = cycles[number]
            order = FarmOrder.objects.create(
                farm=farms[farm_name],
                drop_cycle=cycle,
                pickup_at=at(cycle.drop_date - timedelta(days=1), 9),  # Friday morning before the drop
                pickup_notes=pickup_notes[farm_name],
                status=status,
                farm_note=note,
                responded_at=None if status == FarmOrder.Status.WAITING else cycle.order_cutoff,
                payment=FarmOrder.Payment.PAID if paid else FarmOrder.Payment.NOT_PAID,
                paid_on=min(cycle.drop_date + timedelta(days=5), today) if paid else None,
            )
            for produce, pounds, price in lines:
                FarmOrderLine.objects.create(order=order, produce=produce, pounds=pounds, price_per_pound=Decimal(price))

        for username, first, last, role, site_name in DEMO_USERS:
            user = User(
                username=username, first_name=first, last_name=last, role=role,
                site=sites.get(site_name), farm=farm_for_user.get(username),
            )
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
            f"Created {len(SITES)} locations, {len(FARMS)} farms, {len(cycles)} drop cycles, "
            f"{len(FARM_ORDERS)} farm orders, {len(DEMO_USERS)} demo users and {len(PENDING_SIGNUPS)} pending sign-ups."
        ))
        self.stdout.write(f"Password for every demo user: {DEMO_PASSWORD}")
        for username, first, last, role, site_name in DEMO_USERS:
            self.stdout.write(f"  {username:<20} {role.label}" + (f" ({site_name})" if site_name else ""))
        for signup in PENDING_SIGNUPS:
            username, first, last, role, *_ = signup["user"]
            self.stdout.write(f"  {username:<20} {role.label}, waiting for approval")
