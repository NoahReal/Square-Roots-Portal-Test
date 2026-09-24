"""Makes a copy of the database in backups/, and keeps the most recent copies.

Run it once a day, for example with cron:  python manage.py backup_database
Copy the backups/ folder somewhere else too (another computer or cloud storage) now and then:
a backup on the same machine won't help if that machine is lost.
"""

import sqlite3
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Copy the database into backups/ (safe while the site is running) and delete old copies."

    def add_arguments(self, parser):
        parser.add_argument("--keep", type=int, default=14, help="How many daily copies to keep (default 14).")
        parser.add_argument("--folder", default=str(settings.BASE_DIR / "backups"))

    def handle(self, *args, keep, folder, **options):
        database = Path(settings.DATABASES["default"]["NAME"])
        folder = Path(folder)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f"{database.stem}-{timezone.localtime():%Y-%m-%d-%H%M}.sqlite3"

        # SQLite's own backup copies the database safely even while people are using the site.
        with sqlite3.connect(database) as source, sqlite3.connect(target) as copy:
            source.backup(copy)

        copies = sorted(folder.glob(f"{database.stem}-*.sqlite3"))
        for old in copies[:-keep]:
            old.unlink()
        self.stdout.write(f"Saved {target.name}. Keeping {min(len(copies), keep)} copies in {folder}.")
