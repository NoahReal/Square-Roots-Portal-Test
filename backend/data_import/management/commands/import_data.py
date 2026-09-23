"""Load Square Roots' real data from CSV files.

    python manage.py import_data ../real-data              check the files; changes nothing
    python manage.py import_data ../real-data --apply      load them
    python manage.py import_data ../real-data --apply --invite --site-url http://localhost:5173

Loading is all or nothing: if any row has a problem, nothing is saved. Running it again with
the same files updates what's there instead of making duplicates. See data-templates/README.md.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.views import send_invitation
from data_import.importer import run_import


class DryRun(Exception):
    """Raised to undo everything after a check-only run."""


class Command(BaseCommand):
    help = "Check (and with --apply, load) Square Roots' real data from a folder of CSV files."

    def add_arguments(self, parser):
        parser.add_argument("folder", help="The folder with the CSV files, e.g. ../real-data")
        parser.add_argument("--apply", action="store_true", help="Save the data. Without this, nothing changes.")
        parser.add_argument("--invite", action="store_true", help="Email new people a link to choose their password.")
        parser.add_argument("--site-url", default="http://localhost:5173", help="Where the portal runs, for invitation links.")

    def handle(self, *args, folder, apply, invite, site_url, **options):
        report = None
        try:
            with transaction.atomic():
                report = run_import(folder)
                # Always load inside a transaction, so a check-only run (or any problem) leaves nothing behind.
                if report.problems or not apply:
                    raise DryRun
        except DryRun:
            pass

        self.print_report(report, apply)
        if apply and not report.problems and invite:
            for person in report.new_people:
                send_invitation(person, site_url)
            self.stdout.write(f"Sent {len(report.new_people)} invitations (printed above, since email is stubbed).")

    def print_report(self, report, apply):
        if report.files:
            self.stdout.write("Files read: " + ", ".join(f"{name}.csv" for name in report.files))
        for what, number in report.counts.items():
            self.stdout.write(f"  {what}: {number}")

        if report.problems:
            self.stdout.write(self.style.ERROR(f"\n{len(report.problems)} problems to fix. Nothing was saved:"))
            for file, row, message in report.problems:
                where = f"{file}, row {row}: " if file else ""
                self.stdout.write(f"  - {where}{message}")
            return

        if not apply:
            self.stdout.write(self.style.SUCCESS("\nEverything looks good. Nothing was saved yet; run again with --apply to load it."))
            return

        self.stdout.write(self.style.SUCCESS("\nLoaded."))
        if report.new_people:
            self.stdout.write(f"{len(report.new_people)} new people have no password yet:")
            for person in report.new_people:
                self.stdout.write(f"  {person.username:<22} {person.email}")
            self.stdout.write("Run with --invite to email them a link to choose one, or use People > Send password reset.")
