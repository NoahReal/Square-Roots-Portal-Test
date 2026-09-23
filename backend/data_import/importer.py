"""Reads Square Roots' real data from CSV files into the portal.

Each CSV file is optional; the importer reads whichever ones are in the folder, in this order
(later files can refer to things earlier files created):

    settings.csv        prices and the sorting location (one row)
    locations.csv       Square Roots locations
    farms.csv           partner farms
    people.csv          Community Managers, farm contacts, host sites and admins
    drop_dates.csv      upcoming drops and their order cutoffs
    past_drops.csv      what happened at past drops (orders, bundles sold, donations)
    farm_purchases.csv  what was bought from farms for past drops

The templates in /data-templates show every column. Headers are matched loosely: "Drop date",
"drop_date" and "DROP DATE" all work. Problems are collected with the file and row number, in plain
language, so whoever filled in the spreadsheet can fix them.
"""

import csv
import difflib
import re
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.utils import timezone

from accounts.models import User
from drops.models import BundleOrder, DropCycle, DropReport, OperatingSettings, Site, SiteDrop
from farms.models import Farm, FarmOrder, FarmOrderLine

FILES = ["settings", "locations", "farms", "people", "drop_dates", "past_drops", "farm_purchases"]

ROLES = {
    "community manager": User.Role.COMMUNITY_MANAGER,
    "community_manager": User.Role.COMMUNITY_MANAGER,
    "cm": User.Role.COMMUNITY_MANAGER,
    "farm": User.Role.FARM,
    "host site": User.Role.HOST_SITE,
    "host_site": User.Role.HOST_SITE,
    "host": User.Role.HOST_SITE,
    "admin": User.Role.ADMIN,
}

LEFTOVERS = {
    "": DropReport.Leftovers.NONE,
    "none": DropReport.Leftovers.NONE,
    "donated": DropReport.Leftovers.DONATED,
    "kept": DropReport.Leftovers.KEPT,
    "kept for next drop": DropReport.Leftovers.KEPT,
    "composted": DropReport.Leftovers.COMPOSTED,
    "other": DropReport.Leftovers.OTHER,
}


class RowProblem(Exception):
    """Something wrong with one row. The message is shown to the person fixing the spreadsheet."""


@dataclass
class Report:
    problems: list = field(default_factory=list)  # (file, row, message)
    counts: dict = field(default_factory=dict)  # "Locations added" -> 3
    new_people: list = field(default_factory=list)
    files: list = field(default_factory=list)

    def count(self, what):
        self.counts[what] = self.counts.get(what, 0) + 1

    def problem(self, file, row, message):
        self.problems.append((file, row, message))


# ---------- Reading values ----------


def header_key(name):
    return re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")


def read_rows(path):
    """The rows of a CSV file as dicts with tidy keys, numbered like a spreadsheet (row 2 is the first data row)."""
    # utf-8-sig copes with the invisible marker Excel puts at the start of CSV files.
    with open(path, newline="", encoding="utf-8-sig") as handle:
        for number, row in enumerate(csv.DictReader(handle), start=2):
            tidy = {header_key(k): (v or "").strip() for k, v in row.items() if k}
            if any(tidy.values()):  # skip empty rows
                yield number, tidy


def required(row, key):
    value = row.get(key, "")
    if not value:
        raise RowProblem(f'"{key.replace("_", " ")}" is empty.')
    return value


def parse_date(text, what="date"):
    text = text.strip()
    for pattern in ("%Y-%m-%d", "%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y"):
        try:
            return datetime.strptime(text, pattern).date()
        except ValueError:
            pass
    raise RowProblem(f'The {what} "{text}" isn\'t a date we can read. Write it like 2026-10-10 or October 10, 2026.')


def parse_time(text, what="time"):
    text = text.strip().lower().replace(".", "")
    for pattern in ("%H:%M", "%I:%M %p", "%I %p", "%I:%M%p", "%I%p"):
        try:
            return datetime.strptime(text, pattern).time()
        except ValueError:
            pass
    raise RowProblem(f'The {what} "{text}" isn\'t a time we can read. Write it like 17:00 or 5:00 pm.')


def parse_money(text, what="amount"):
    cleaned = text.replace("$", "").replace(",", "").strip() or "0"
    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        raise RowProblem(f'The {what} "{text}" isn\'t an amount of money. Write it like 7.50.')
    if value < 0:
        raise RowProblem(f"The {what} can't be below $0.")
    return value


def parse_count(text, what):
    cleaned = text.replace(",", "").strip() or "0"
    if not cleaned.isdigit():
        raise RowProblem(f'"{what}" should be a whole number, not "{text}".')
    return int(cleaned)


def parse_yes_no(text):
    return text.strip().lower() in ("yes", "y", "true", "1", "x")


def closest(name, choices):
    match = difflib.get_close_matches(name.lower(), [c.lower() for c in choices], n=1, cutoff=0.6)
    if not match:
        return ""
    original = next(c for c in choices if c.lower() == match[0])
    return f' Did you mean "{original}"?'


def find_site(name):
    site = Site.objects.filter(name__iexact=name.strip()).first()
    if site is None:
        names = list(Site.objects.values_list("name", flat=True))
        raise RowProblem(f'There\'s no location called "{name}".{closest(name, names)} Add it to locations.csv first.')
    return site


def find_farm(name):
    farm = Farm.objects.filter(name__iexact=name.strip()).first()
    if farm is None:
        names = list(Farm.objects.values_list("name", flat=True))
        raise RowProblem(f'There\'s no farm called "{name}".{closest(name, names)} Add it to farms.csv first.')
    return farm


def at(day, clock):
    """A date and time in the portal's time zone (Halifax)."""
    return timezone.make_aware(datetime.combine(day, clock))


def cycle_for(drop_date, cutoff=None):
    """The drop cycle on this date, creating it if needed. Cutoff defaults to 5 pm four days before."""
    cycle = DropCycle.objects.filter(drop_date=drop_date).first()
    if cycle:
        return cycle, False
    cutoff = cutoff or at(drop_date - timedelta(days=4), time(17))
    return DropCycle.objects.create(name=f"{drop_date:%B} {drop_date.day} drop", drop_date=drop_date, order_cutoff=cutoff), True


def unique_username(email, first_name):
    base = re.sub(r"[^a-z0-9.]", "", (email.split("@")[0] if email else first_name).lower()) or "partner"
    username, number = base, 2
    while User.objects.filter(username__iexact=username).exists():
        username, number = f"{base}{number}", number + 1
    return username


# ---------- One function per file ----------


def import_settings(row, report):
    settings = OperatingSettings.current()
    for key in ("standard_price", "at_cost_price", "first_drop_cost", "delivery_fee"):
        if row.get(key):
            setattr(settings, key, parse_money(row[key], key.replace("_", " ")))
    if row.get("staging_location"):
        settings.staging_location = row["staging_location"]
    if settings.at_cost_price > settings.standard_price:
        raise RowProblem("The at-cost price can't be more than the standard price.")
    settings.save()
    report.count("Settings updated")


def import_location(row, report):
    name = required(row, "name")
    site = Site.objects.filter(name__iexact=name).first()
    created = site is None
    if created:
        last = Site.objects.order_by("-sort_order").first()
        site = Site(name=name, sort_order=(last.sort_order + 1) if last else 0)
    site.address = required(row, "address")
    for key in ("instagram_url", "facebook_url", "delivery_partner", "highlight"):
        if key in row:
            setattr(site, key, row[key])
    for url_key in ("instagram_url", "facebook_url"):
        if getattr(site, url_key) and not getattr(site, url_key).startswith("http"):
            raise RowProblem(f'"{url_key.replace("_", " ")}" should be a full link starting with https://')
    if "first_drop_pricing" in row:
        site.first_drop_pricing = parse_yes_no(row["first_drop_pricing"])
    if "active" in row and row["active"]:
        site.is_active = parse_yes_no(row["active"])
    site.save()
    report.count("Locations added" if created else "Locations updated")


def import_farm(row, report):
    name = required(row, "name")
    farm, created = Farm.objects.get_or_create(name=name)
    if row.get("location"):
        farm.location = row["location"]
    if row.get("pickup_notes"):
        farm.pickup_notes = row["pickup_notes"]
    farm.save()
    report.count("Farms added" if created else "Farms updated")


def import_person(row, report):
    first_name = required(row, "first_name")
    email = required(row, "email").lower()
    if "@" not in email:
        raise RowProblem(f'"{email}" doesn\'t look like an email address.')
    role_text = required(row, "role")
    role = ROLES.get(role_text.lower())
    if role is None:
        raise RowProblem(f'The role "{role_text}" isn\'t one we know. Use Community Manager, Farm, Host Site or Admin.')

    site = farm = None
    if role in (User.Role.COMMUNITY_MANAGER, User.Role.HOST_SITE):
        if not row.get("location"):
            raise RowProblem(f"{role.label}s need a location. Put their location's name in the \"location\" column.")
        site = find_site(row["location"])
    if role == User.Role.FARM:
        if not row.get("farm"):
            raise RowProblem('Farm contacts need a farm. Put the farm\'s name in the "farm" column.')
        farm = find_farm(row["farm"])

    person = User.objects.filter(email__iexact=email).first()
    created = person is None
    if created:
        username = row.get("username") or unique_username(email, first_name)
        if User.objects.filter(username__iexact=username).exists():
            raise RowProblem(f'The username "{username}" is already taken.')
        person = User(username=username, email=email)
        person.set_unusable_password()  # they choose their own from the invitation email
        report.new_people.append(person)
    person.first_name = first_name
    person.last_name = row.get("last_name", "")
    person.phone = row.get("phone", person.phone)
    person.role = role
    person.status = User.Status.APPROVED
    person.site = site
    person.farm = farm
    person.is_staff = role == User.Role.ADMIN
    person.save()
    report.count("People added" if created else "People updated")


def import_drop_date(row, report):
    drop_date = parse_date(required(row, "drop_date"), "drop date")
    cutoff_day = parse_date(row["cutoff_date"], "cutoff date") if row.get("cutoff_date") else drop_date - timedelta(days=4)
    cutoff_time = parse_time(row["cutoff_time"], "cutoff time") if row.get("cutoff_time") else time(17)
    cutoff = at(cutoff_day, cutoff_time)
    if cutoff_day >= drop_date:
        raise RowProblem("Ordering should close before the drop date.")
    starts = parse_time(row["starts_at"], "start time") if row.get("starts_at") else time(11)
    ends = parse_time(row["ends_at"], "end time") if row.get("ends_at") else time(13)
    if ends <= starts:
        raise RowProblem("The drop should end after it starts.")

    which = row.get("locations", "").strip()
    if not which or which.lower() == "all":
        sites = list(Site.objects.filter(is_active=True))
    else:
        sites = [find_site(name) for name in which.split(";") if name.strip()]

    cycle, created = cycle_for(drop_date, cutoff)
    report.count("Drop dates added" if created else "Drop dates already there")
    for site in sites:
        _, added = SiteDrop.objects.get_or_create(
            cycle=cycle, site=site,
            defaults={"drop_date": drop_date, "order_cutoff": cycle.order_cutoff, "starts_at": starts, "ends_at": ends},
        )
        if added:
            report.count("Location drops added")


def import_past_drop(row, report):
    drop_date = parse_date(required(row, "drop_date"), "drop date")
    if drop_date > timezone.localdate():
        raise RowProblem("This drop is in the future. Put upcoming drops in drop_dates.csv instead.")
    site = find_site(required(row, "location"))
    cycle, _ = cycle_for(drop_date)
    site_drop, _ = SiteDrop.objects.get_or_create(
        cycle=cycle, site=site, defaults={"drop_date": drop_date, "order_cutoff": cycle.order_cutoff}
    )

    standard = parse_count(row.get("bundles_standard", ""), "bundles standard")
    at_cost = parse_count(row.get("bundles_at_cost", ""), "bundles at cost")
    free = parse_count(row.get("bundles_free", ""), "bundles free")
    left_over = parse_count(row.get("bundles_left_over", ""), "bundles left over")
    ordered = parse_count(row["bundles_ordered"], "bundles ordered") if row.get("bundles_ordered") else standard + at_cost + free + left_over
    if standard + at_cost + free == 0 and ordered == 0:
        raise RowProblem("Add how many bundles were ordered or sold.")
    went_to = LEFTOVERS.get(row.get("leftovers_went_to", "").lower())
    if went_to is None:
        raise RowProblem('"leftovers went to" should be donated, kept, composted, other, or empty.')
    if left_over and went_to == DropReport.Leftovers.NONE:
        went_to = DropReport.Leftovers.OTHER

    BundleOrder.objects.update_or_create(site_drop=site_drop, defaults={"bundles": ordered})
    DropReport.objects.update_or_create(
        site_drop=site_drop,
        defaults={
            "bundles_standard": standard,
            "bundles_at_cost": at_cost,
            "bundles_free": free,
            "bundles_left_over": left_over,
            "leftovers_went_to": went_to,
            "donations": parse_money(row.get("donations", ""), "donations"),
            "notes": row.get("notes", ""),
            "remittance_received_on": parse_date(row["payment_received_on"], "payment date") if row.get("payment_received_on") else None,
        },
    )
    report.count("Past drops loaded")


def import_farm_purchase(row, report):
    drop_date = parse_date(required(row, "drop_date"), "drop date")
    farm = find_farm(required(row, "farm"))
    produce = required(row, "produce")
    pounds = parse_count(required(row, "pounds"), "pounds")
    price = parse_money(required(row, "price_per_pound"), "price per pound")
    cycle, _ = cycle_for(drop_date)
    pickup = at(drop_date - timedelta(days=1), time(9))
    paid = parse_yes_no(row.get("paid", ""))
    order, _ = FarmOrder.objects.get_or_create(
        farm=farm, drop_cycle=cycle,
        defaults={
            "pickup_at": pickup,
            "pickup_notes": farm.pickup_notes,
            "status": FarmOrder.Status.CONFIRMED,
            "sent_at": pickup,
            "responded_at": pickup,
        },
    )
    if paid and order.payment != FarmOrder.Payment.PAID:
        order.payment = FarmOrder.Payment.PAID
        order.save()
    FarmOrderLine.objects.update_or_create(
        order=order, produce=produce, defaults={"pounds": pounds, "price_per_pound": price}
    )
    report.count("Farm purchases loaded")


HANDLERS = {
    "settings": import_settings,
    "locations": import_location,
    "farms": import_farm,
    "people": import_person,
    "drop_dates": import_drop_date,
    "past_drops": import_past_drop,
    "farm_purchases": import_farm_purchase,
}


def run_import(folder):
    """Reads every CSV in the folder. Call inside a transaction; roll back if report.problems isn't empty."""
    report = Report()
    folder = Path(folder)
    found = [name for name in FILES if (folder / f"{name}.csv").exists()]
    if not found:
        report.problem("", 0, f"No data files found in {folder}. Expected names like locations.csv or people.csv.")
    for name in found:
        for number, row in read_rows(folder / f"{name}.csv"):
            # The templates' example rows start with "EXAMPLE", in case nobody deletes them.
            if next(iter(row.values()), "").upper().startswith("EXAMPLE"):
                report.count("Example rows skipped")
                continue
            try:
                HANDLERS[name](row, report)
            except RowProblem as problem:
                report.problem(f"{name}.csv", number, str(problem))
    report.files = found
    return report
