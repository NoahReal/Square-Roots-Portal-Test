"""Load demo data:  python manage.py seed

Safe to run again: it deletes the demo data first, then recreates it.
Every demo account uses the same password, DEMO_PASSWORD below.

Dates are worked out from today, so the demo always has a drop coming up,
one whose ordering has just closed, and a year of history for the Impact screen.
The "random" numbers use a fixed seed, so every run gives the same demo.
"""

import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Application, User
from drops.models import (
    BundleOrder, DropCycle, DropReport, OperatingSettings, Preorder, Site, SiteDrop, StandingReservation, WaitlistEntry,
    new_manage_token,
)
from farms.models import Farm, FarmOrder, FarmOrderLine, ProduceListing
from website.models import AreaRequest, ContactMessage, Event

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

# Home delivery partners, from what Square Roots told us (BayRides serves the St. Margaret's Bay area).
DELIVERY_PARTNERS = {"Upper Tantallon": "BayRides"}

# Made-up addresses for demo home deliveries.
DELIVERY_ADDRESSES = ["12 Peggy's Cove Rd", "48 Hubley Mill Lake Rd", "7 Boutiliers Point Rd", "215 Hammonds Plains Rd"]

# Locations that haven't turned on online reservations yet (so the demo shows that case too).
NO_ONLINE_RESERVATIONS = {"Middle Musquodoboit"}

# Made-up ordering habits for the demo: (usual bundles per drop, month the location started this year, drop hours)
SITE_HABITS = {
    "Fairview / Clayton Park": (28, 1, (11, 13)),
    "Upper Tantallon": (14, 1, (10, 12)),
    "Halifax - South End": (22, 1, (11, 13)),
    "Windsor": (12, 2, (13, 15)),
    "East Dartmouth": (18, 1, (11, 13)),
    "New Glasgow": (10, 8, (10, 12)),
    "Lower Sackville": (26, 1, (11, 13)),
    "Halifax - North End": (30, 1, (12, 14)),
    "Middle Musquodoboit": (8, 5, (10, 12)),
    "Dartmouth": (24, 1, (11, 13)),
    "Cole Harbour": (16, 3, (13, 15)),
}

# Approved accounts: (username, first name, last name, role, site name or None)
DEMO_USERS = [
    ("admin", "Maya", "Chen", User.Role.ADMIN, None),
    ("cm.dartmouth", "Jordan", "MacLeod", User.Role.COMMUNITY_MANAGER, "Dartmouth"),
    ("cm.northend", "Aisha", "Rahman", User.Role.COMMUNITY_MANAGER, "Halifax - North End"),
    ("cm.sackville", "Liam", "Boudreau", User.Role.COMMUNITY_MANAGER, "Lower Sackville"),
    ("farm.gaspereau", "Ruth", "Eisenhauer", User.Role.FARM, None),
    ("farm.canard", "Tom", "Van Dyk", User.Role.FARM, None),
    ("host.dartmouth", "Grace", "Oickle", User.Role.HOST_SITE, "Dartmouth"),
]
DEMO_PHONES = {"cm.dartmouth": "902-555-0123", "cm.northend": "902-555-0167", "cm.sackville": "902-555-0184"}

# Fictional farms: (name, location, pickup notes, demo username, share of each order, what they sell with $/lb)
FARMS = [
    (
        "Gaspereau Valley Growers", "Gaspereau, Kings County", "Square Roots van picks up at the farm stand.",
        "farm.gaspereau", 0.6,
        [("Carrots", "0.35"), ("Yukon Gold potatoes", "0.30"), ("Beets", "0.45"), ("Apples (Cortland seconds)", "0.55")],
    ),
    (
        "Canard Creek Farm", "Canard, Kings County", "Load from the cold storage barn. Please bring your own bins.",
        "farm.canard", 0.4,
        [("Green cabbage", "0.40"), ("Yellow onions", "0.40"), ("Rutabaga", "0.30")],
    ),
]

# Produce each farm has posted right now: (produce, lbs, $/lb, days until it's gone, notes)
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
        ("Rutabaga", 300, "0.30", 60, ""),
    ],
}

# Farm orders for the most recent cycles, so every state shows up in the demo.
# Cycle numbers count from the next drop: -1 is the last one, 0 is this Saturday, 1 is in two weeks.
# Older cycles are all confirmed and paid. (farm, cycle): (status, paid?, farm's note)
RECENT_FARM_ORDERS = {
    ("Gaspereau Valley Growers", -2): (FarmOrder.Status.CONFIRMED, True, ""),
    ("Gaspereau Valley Growers", -1): (FarmOrder.Status.CONFIRMED, False, ""),
    ("Gaspereau Valley Growers", 0): (FarmOrder.Status.CONFIRMED, False, ""),
    ("Gaspereau Valley Growers", 1): (FarmOrder.Status.WAITING, False, ""),
    ("Canard Creek Farm", -2): (FarmOrder.Status.CANT_FILL, False, "Hail damage last week, nothing to spare. Sorry!"),
    ("Canard Creek Farm", -1): (FarmOrder.Status.CONFIRMED, True, ""),
    ("Canard Creek Farm", 0): (FarmOrder.Status.WAITING, False, ""),
    # No Canard order yet for cycle 1: the admin can buy from Canard on the Farms screen.
}

# Made-up customer names for preorders.
CUSTOMERS = [
    "Alex B.", "Morgan T.", "Sam R.", "Jamie L.", "Taylor K.", "Chris M.", "Pat D.", "Robin S.",
    "Casey W.", "Drew F.", "Jordan P.", "Riley H.", "Avery N.", "Quinn O.", "Jesse G.",
]

LEFTOVER_PLACES = [DropReport.Leftovers.DONATED, DropReport.Leftovers.DONATED, DropReport.Leftovers.KEPT, DropReport.Leftovers.COMPOSTED]

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


def at(day, hour, minute=0):
    """A time on a given date, in the portal's time zone (Halifax)."""
    return timezone.make_aware(datetime.combine(day, time(hour, minute)))


def round_to(value, step=10):
    return max(step, int(round(value / step)) * step)


class Command(BaseCommand):
    help = "Delete and recreate the demo data: locations, farms, a year of drops and orders, users and sample sign-ups."

    @transaction.atomic
    def handle(self, *args, **options):
        self.random = random.Random(2026)
        # Separate, so adding reservations doesn't change the rest of the demo numbers.
        self.reservation_random = random.Random(10)
        self.today = timezone.localdate()

        self.delete_everything()
        sites = self.create_sites()
        farms = self.create_farms()
        users = self.create_users(sites, farms)
        counts = self.create_drop_history(sites, farms, users)
        self.create_signups(sites)
        self.create_events()
        self.create_area_requests()

        self.stdout.write(self.style.SUCCESS(
            f"Created {len(SITES)} locations, {len(FARMS)} farms, {counts['cycles']} drop cycles "
            f"({counts['site_drops']} site drops), {counts['farm_orders']} farm orders, "
            f"{len(DEMO_USERS)} demo users and {len(PENDING_SIGNUPS)} pending sign-ups."
        ))
        self.stdout.write(f"Password for every demo user: {DEMO_PASSWORD}")
        for username, _first, _last, role, site_name in DEMO_USERS:
            self.stdout.write(f"  {username:<20} {role.label}" + (f" ({site_name})" if site_name else ""))
        for signup in PENDING_SIGNUPS:
            username, _first, _last, role, *_ = signup["user"]
            self.stdout.write(f"  {username:<20} {role.label}, waiting for approval")

    def delete_everything(self):
        User.objects.filter(is_superuser=False).delete()  # also deletes their applications
        FarmOrder.objects.all().delete()
        Farm.objects.all().delete()  # also deletes produce listings
        DropCycle.objects.all().delete()  # also deletes site drops, orders, preorders and reports
        Site.objects.all().delete()
        ContactMessage.objects.all().delete()
        Event.objects.all().delete()
        AreaRequest.objects.all().delete()

    def create_sites(self):
        # Prices from Square Roots: $10 standard, $7.50 at cost, free bundles, $1.99 delivery.
        # The first-drop price isn't known yet; $3.75 is a sample for the team to change.
        OperatingSettings.objects.all().delete()
        OperatingSettings.current()
        sites = {}
        for order, (name, address, instagram, facebook, highlight) in enumerate(SITES):
            sites[name] = Site.objects.create(
                name=name, address=address, instagram_url=instagram, facebook_url=facebook,
                highlight=highlight, sort_order=order, delivery_partner=DELIVERY_PARTNERS.get(name, ""),
                # Only the newest location started this year with the first-drop incentive.
                first_drop_pricing=name == "New Glasgow",
                online_reservations=name not in NO_ONLINE_RESERVATIONS,
                # About half of a location's usual bundles are set aside for reservations.
                # The North End is kept small so its next drop fills up and shows the waitlist.
                reservation_limit=12 if name == "Halifax - North End" else round_to(SITE_HABITS[name][0] / 2, 2),
            )
        return sites

    def create_farms(self):
        farms = {}
        for name, location, pickup_notes, _username, _share, _produce in FARMS:
            farms[name] = Farm.objects.create(name=name, location=location, pickup_notes=pickup_notes)
            for produce, pounds, price, days_left, notes in LISTINGS[name]:
                ProduceListing.objects.create(
                    farm=farms[name], produce=produce, pounds=pounds, price_per_pound=Decimal(price),
                    available_until=self.today + timedelta(days=days_left), notes=notes,
                )
        return farms

    def create_users(self, sites, farms):
        farm_for_user = {username: farms[name] for name, _l, _n, username, _s, _p in FARMS}
        users = {}
        for username, first, last, role, site_name in DEMO_USERS:
            user = User(
                username=username, first_name=first, last_name=last, role=role,
                email=f"{username}@example.com", phone=DEMO_PHONES.get(username, ""),
                site=sites.get(site_name), farm=farm_for_user.get(username),
            )
            # Admins can also open Django's built-in admin at /django-admin/.
            user.is_staff = role == User.Role.ADMIN
            user.set_password(DEMO_PASSWORD)
            user.save()
            users[username] = user
        return users

    def create_signups(self, sites):
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

    def create_area_requests(self):
        """Made-up "bring Square Roots to my area" requests, so the admin screen has something to show."""
        for postal_code, town, could_help in [
            ("B4N 2L1", "Kentville", True), ("B4N 1A5", "Kentville", False), ("B4N", "", False),
            ("B2N 3Z7", "Truro", False), ("B2N 5B1", "Truro", True), ("B4A 3K2", "Bedford", False),
            ("B2G 2W5", "Antigonish", False),
        ]:
            AreaRequest.objects.create(
                email=f"{(town or 'someone').lower()}.{len(postal_code)}{int(could_help)}@example.com",
                postal_code=postal_code, town=town, could_help=could_help,
            )

    def create_events(self):
        """The event from squarerootssmu.ca/events. The live page doesn't give a year; 2024 is a guess
        from the site's "© 2024" footer, so check it with the Square Roots team."""
        Event.objects.create(
            title="Saint Mary's - NSCC Ivany",
            starts_on=date(2024, 8, 31),
            ends_on=date(2024, 9, 1),
            time_text="12 to 4 p.m.",
            location="Gorsebrook Park (facing Inglis), Halifax",
            description=(
                "We gave away free produce at Gorsebrook Park, and free bundles with the help of "
                "Enactus NSCC Ivany at their campus."
            ),
        )

    # ---------- A year of drops ----------

    def create_drop_history(self, sites, farms, users):
        """Every second Saturday this year: site drops, bundle orders, reports, preorders and farm orders."""
        next_saturday = self.today + timedelta(days=(5 - self.today.weekday()) % 7)
        first = next_saturday
        while first - timedelta(weeks=2) >= date(self.today.year, 1, 1):
            first -= timedelta(weeks=2)

        counts = {"cycles": 0, "site_drops": 0, "farm_orders": 0}
        drop_date = first
        while drop_date.year == self.today.year:
            number = (drop_date - next_saturday).days // 14
            cycle = DropCycle.objects.create(
                name=f"{drop_date:%B} {drop_date.day} drop",
                drop_date=drop_date,
                order_cutoff=at(drop_date - timedelta(days=4), 17),  # Tuesday at 5 pm
            )
            counts["cycles"] += 1
            bundles_total = 0
            for site_name, site in sites.items():
                usual, first_month, hours = SITE_HABITS[site_name]
                if drop_date.month < first_month:
                    continue
                site_drop = SiteDrop.objects.create(
                    cycle=cycle, site=site, drop_date=drop_date, order_cutoff=cycle.order_cutoff,
                    starts_at=time(hours[0]), ends_at=time(hours[1]),
                )
                counts["site_drops"] += 1
                bundles_total += self.fill_site_drop(site_drop, number, usual, users)
                if number == 1 and site.online_reservations:
                    self.add_online_reservations(site_drop)
                if number == 2:
                    self.add_every_drop_reservations(site_drop)
            counts["farm_orders"] += self.create_farm_orders(cycle, number, bundles_total, farms)
            drop_date += timedelta(weeks=2)
        return counts

    def fill_site_drop(self, site_drop, number, usual, users):
        """Adds the bundle order, report and preorders a site drop would have by now. Returns bundles ordered."""
        site_name = site_drop.site.name
        manager = next(
            (u for u in users.values() if u.site_id == site_drop.site_id and u.role == User.Role.COMMUNITY_MANAGER), None
        )

        # Orders: every past drop and this Saturday's drop have one. For the drop in two weeks,
        # about half the sites have ordered so far, but not Dartmouth (so the demo can order there).
        if number > 1:
            return 0
        if number == 1 and (site_name == "Dartmouth" or site_drop.site.sort_order % 2 == 0):
            return 0
        growth = 1 + 0.3 * (site_drop.drop_date.month - 1) / 11  # a busier second half of the year
        bundles = max(4, round(usual * growth * self.random.uniform(0.8, 1.2)))
        BundleOrder.objects.create(site_drop=site_drop, bundles=bundles, updated_by=manager)

        # Reports: logged for every past drop, except the last one at Dartmouth and the North End.
        # Sold bundles are split across the sliding scale: about 70% standard, 20% at cost, 10% free.
        if number < 0 and not (number == -1 and site_name in ("Dartmouth", "Halifax - North End")):
            left_over = self.random.choice([0, 0, 0, 1, 2, 3])
            sold = bundles - left_over
            free = round(sold * self.random.uniform(0.05, 0.15))
            at_cost = round(sold * self.random.uniform(0.15, 0.25))
            DropReport.objects.create(
                site_drop=site_drop,
                bundles_standard=sold - free - at_cost,
                bundles_at_cost=at_cost,
                bundles_free=free,
                bundles_left_over=left_over,
                leftovers_went_to=self.random.choice(LEFTOVER_PLACES) if left_over else DropReport.Leftovers.NONE,
                donations=Decimal(self.random.choice([0, 0, 5, 10, 15, 20, 25])),
                # Community Managers have paid Square Roots for everything except the last two drops.
                remittance_received_on=site_drop.drop_date + timedelta(days=6) if number < -2 else None,
            )

        # Preorders at the sites with demo Community Managers, for the last drop and this Saturday.
        if manager and number in (-1, 0):
            for customer in self.random.sample(CUSTOMERS, self.random.randint(5, 8)):
                Preorder.objects.create(
                    site_drop=site_drop, customer_name=customer, bundles=self.random.choice([1, 1, 1, 2]),
                    phone=f"902-555-{self.random.randint(1000, 9999)}" if self.random.random() < 0.6 else "",
                    price_tier=self.random.choice(["standard"] * 7 + ["at_cost"] * 2 + ["free"]),
                    paid=number < 0 or self.random.random() < 0.5,
                    picked_up=number < 0,
                )
        # Home deliveries where a delivery partner operates, for this Saturday.
        if site_drop.site.delivery_partner and number == 0:
            for customer, address in zip(self.random.sample(CUSTOMERS, 3), DELIVERY_ADDRESSES):
                Preorder.objects.create(
                    site_drop=site_drop, customer_name=customer, bundles=1, delivery=True, delivery_address=address,
                    phone=f"902-555-{self.random.randint(1000, 9999)}", paid=True,
                )
        return bundles

    def add_online_reservations(self, site_drop):
        """Customers who have reserved online for the drop in two weeks. The North End is full, with a waitlist."""
        rnd = self.reservation_random
        limit = site_drop.site.reservation_limit
        full = site_drop.site.name == "Halifax - North End"
        target = limit if full else rnd.randint(1, max(1, limit // 3))
        customers = rnd.sample(CUSTOMERS, len(CUSTOMERS))
        reserved = 0
        while reserved < target and customers:
            name = customers.pop()
            bundles = min(rnd.choice([1, 1, 1, 2]), target - reserved)
            delivery = bool(site_drop.site.delivery_partner) and rnd.random() < 0.3
            tier = rnd.choice(["standard"] * 7 + ["at_cost"] * 2 + ["free"])
            details = {
                "customer_name": name, "bundles": bundles, "price_tier": tier,
                "email": f"{name.split()[0].lower()}{rnd.randint(10, 99)}@example.com",
                "phone": f"902-555-{rnd.randint(1000, 9999)}" if rnd.random() < 0.4 else "",
                # About a quarter of people paying the standard price add a pay-it-forward gift.
                "pay_it_forward": Decimal(rnd.choice([2, 5, 10])) if tier == "standard" and rnd.random() < 0.25 else Decimal("0"),
                "delivery": delivery, "delivery_address": rnd.choice(DELIVERY_ADDRESSES) if delivery else "",
            }
            # The first person at each location with a demo Community Manager reserves every drop.
            standing = None
            if reserved == 0 and site_drop.site.people.exists():
                standing = StandingReservation.objects.create(site=site_drop.site, **details)
            Preorder.objects.create(
                site_drop=site_drop, source=Preorder.Source.ONLINE, manage_token=new_manage_token(), standing=standing,
                **details,
            )
            reserved += bundles
        # Dartmouth's host site has reserved for two people it supports, and one customer uses French.
        if site_drop.site.name == "Dartmouth":
            host = site_drop.site.people.filter(role=User.Role.HOST_SITE).first()
            for name, bundles in [("M.K.", 1), ("Community lunch table", 2)]:
                Preorder.objects.create(
                    site_drop=site_drop, customer_name=name, bundles=bundles, price_tier="free",
                    source=Preorder.Source.HOST, reserved_by=host,
                )
            Preorder.objects.create(
                site_drop=site_drop, customer_name="Émilie L.", email="emilie.l@example.com", bundles=1,
                source=Preorder.Source.ONLINE, manage_token=new_manage_token(), language="fr",
            )
        if full:
            for name in customers[:2]:
                WaitlistEntry.objects.create(
                    site_drop=site_drop, customer_name=name, bundles=1,
                    email=f"{name.split()[0].lower()}{rnd.randint(10, 99)}@example.com",
                )

    def add_every_drop_reservations(self, site_drop):
        """People who reserve every drop already have a reservation for the drop after next."""
        for standing in site_drop.site.standing_reservations.all():
            fields = ["customer_name", "phone", "email", "bundles", "price_tier", "pay_it_forward", "delivery", "delivery_address"]
            Preorder.objects.create(
                site_drop=site_drop, source=Preorder.Source.ONLINE, manage_token=new_manage_token(), standing=standing,
                **{field: getattr(standing, field) for field in fields},
            )

    def create_farm_orders(self, cycle, number, bundles_total, farms):
        """Buys the produce for a cycle from the farms. Returns how many orders it made."""
        if number > 1 or bundles_total == 0:
            return 0
        made = 0
        bought_so_far = 0
        for farm_name, _location, pickup_notes, _username, share, produce in FARMS:
            if number >= -2:
                if (farm_name, number) not in RECENT_FARM_ORDERS:
                    continue
                status, paid, note = RECENT_FARM_ORDERS[(farm_name, number)]
            else:
                status, paid, note = FarmOrder.Status.CONFIRMED, True, ""

            order = FarmOrder.objects.create(
                farm=farms[farm_name],
                drop_cycle=cycle,
                pickup_at=at(cycle.drop_date - timedelta(days=1), 9),  # Friday morning before the drop
                pickup_notes=pickup_notes,
                status=status,
                farm_note=note,
                responded_at=None if status == FarmOrder.Status.WAITING else cycle.order_cutoff,
                payment=FarmOrder.Payment.PAID if paid else FarmOrder.Payment.NOT_PAID,
                paid_on=min(cycle.drop_date + timedelta(days=5), self.today) if paid else None,
                # Orders go to farms in one batch once ordering closes; the drop in two weeks is still a draft.
                sent_at=None if number >= 1 else cycle.order_cutoff,
            )
            # This farm's share of the pounds, split across two of its crops (rotating each cycle).
            # The last farm takes whatever is left, so the purchases add up to exactly what's needed.
            needed = bundles_total * 10
            pounds = needed - bought_so_far if farm_name == FARMS[-1][0] and number < -2 else round_to(needed * share)
            bought_so_far += pounds
            first, second = produce[number % len(produce)], produce[(number + 1) % len(produce)]
            first_pounds = round_to(pounds * 0.6)
            for (name, price), line_pounds in ((first, first_pounds), (second, pounds - first_pounds)):
                FarmOrderLine.objects.create(order=order, produce=name, pounds=line_pounds, price_per_pound=Decimal(price))
            made += 1
        return made
