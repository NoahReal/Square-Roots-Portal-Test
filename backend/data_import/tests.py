import shutil
import tempfile
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.core import mail
from django.core.management import call_command
from django.test import TestCase

from accounts.models import User
from drops.models import DropCycle, DropReport, Site, SiteDrop
from farms.models import Farm, FarmOrder
from drops.views_operations import statements_for

TEMPLATES = Path(settings.BASE_DIR).parent / "data-templates"


class ImportTestCase(TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.folder)

    def write(self, name, text):
        (self.folder / f"{name}.csv").write_text(text.strip() + "\n")

    def run_import(self, *flags):
        out = StringIO()
        call_command("import_data", str(self.folder), *flags, stdout=out)
        return out.getvalue()


class TemplateTests(ImportTestCase):
    def test_the_templates_load_as_shipped_with_example_rows_skipped(self):
        for csv_file in TEMPLATES.glob("*.csv"):
            shutil.copy(csv_file, self.folder)
        output = self.run_import("--apply")
        self.assertIn("Loaded.", output)
        self.assertIn("Example rows skipped", output)
        self.assertEqual(Site.objects.count(), 11)  # the real locations, from the website
        self.assertFalse(Farm.objects.exists())
        self.assertFalse(User.objects.exists())
        self.assertEqual(Site.objects.get(name="Upper Tantallon").delivery_partner, "BayRides")


class CheckingTests(ImportTestCase):
    def test_checking_saves_nothing(self):
        self.write("locations", "name,address\nWindsor,613 King St")
        output = self.run_import()
        self.assertIn("Nothing was saved yet", output)
        self.assertFalse(Site.objects.exists())

    def test_problems_are_listed_with_rows_and_nothing_is_saved(self):
        self.write("locations", "Name,Address\nLower Sackville,636 Sackville Dr")
        self.write(
            "people",
            """First name,Last name,Email,Role,Location
Jordan,MacLeod,jordan@example.com,Community Manager,Lower Sackvile
Aisha,Rahman,not-an-email,Community Manager,Lower Sackville
Liam,Boudreau,liam@example.com,Gardener,Lower Sackville""",
        )
        output = self.run_import("--apply")
        self.assertIn("3 problems to fix. Nothing was saved", output)
        self.assertIn('people.csv, row 2: There\'s no location called "Lower Sackvile". Did you mean "Lower Sackville"?', output)
        self.assertIn("people.csv, row 3", output)
        self.assertIn('The role "Gardener"', output)
        self.assertFalse(Site.objects.exists())  # all or nothing

    def test_dates_times_and_money_in_plain_formats(self):
        self.write("locations", "name,address\nWindsor,613 King St")
        self.write("drop_dates", "drop_date,cutoff_date,cutoff_time,starts_at,ends_at,locations\nOctober 24 2030,2030-10-20,5:00 pm,1:00 pm,3 pm,Windsor")
        self.write("settings", "standard_price,at_cost_price,first_drop_cost\n$10.00,7.50,4")
        self.run_import("--apply")
        drop = SiteDrop.objects.get()
        self.assertEqual((str(drop.drop_date), drop.starts_at.hour, drop.ends_at.hour), ("2030-10-24", 13, 15))
        self.write("drop_dates", "drop_date,locations\n10/24/2030,all")
        self.assertIn("isn't a date we can read", self.run_import())


class LoadingTests(ImportTestCase):
    def setUp(self):
        super().setUp()
        self.write("locations", "name,address,first_drop_pricing\nDartmouth,105 Highfield Park Dr,no\nBedford,1 Library Rd,yes")
        self.write("farms", "name,location,pickup_notes\nCanard Creek Farm,Canard,Cold storage barn")
        self.write(
            "people",
            """first_name,last_name,email,phone,role,location,farm
Jordan,MacLeod,Jordan.MacLeod@example.com,902-555-0123,Community Manager,Dartmouth,
Tom,Van Dyk,tom@example.com,,Farm,,Canard Creek Farm
Maya,Chen,maya@example.com,,Admin,,""",
        )

    def test_people_are_linked_and_have_no_password_until_invited(self):
        output = self.run_import("--apply", "--invite", "--site-url", "http://portal.example")
        jordan = User.objects.get(email="jordan.macleod@example.com")
        self.assertEqual((jordan.username, jordan.site.name, jordan.role), ("jordan.macleod", "Dartmouth", "community_manager"))
        self.assertFalse(jordan.has_usable_password())
        self.assertEqual(User.objects.get(username="tom").farm.name, "Canard Creek Farm")
        self.assertTrue(User.objects.get(username="maya").is_staff)
        self.assertIn("Sent 3 invitations", output)
        self.assertIn("http://portal.example/portal/reset-password?uid=", mail.outbox[0].body)

    def test_running_again_updates_instead_of_duplicating(self):
        self.run_import("--apply")
        self.write("farms", "name,location,pickup_notes\nCanard Creek Farm,Canard,Side door now")
        output = self.run_import("--apply")
        self.assertIn("Farms updated: 1", output)
        self.assertEqual(Farm.objects.get().pickup_notes, "Side door now")
        self.assertEqual(User.objects.count(), 3)
        self.assertEqual(Site.objects.count(), 2)

    def test_past_drops_and_farm_purchases_fill_money_and_impact(self):
        self.write(
            "past_drops",
            """drop_date,location,bundles_ordered,bundles_standard,bundles_at_cost,bundles_free,bundles_left_over,leftovers_went_to,donations,payment_received_on
2026-01-10,Dartmouth,28,20,5,2,1,donated,$15,2026-01-16
2026-01-10,Bedford,10,8,2,0,0,,0,""",
        )
        self.write("farm_purchases", "drop_date,farm,produce,pounds,price_per_pound,paid\n2026-01-10,Canard Creek Farm,Carrots,400,0.35,yes")
        self.run_import("--apply")

        self.assertEqual(DropCycle.objects.get().name, "January 10 drop")
        self.assertEqual(DropReport.objects.get(site_drop__site__name="Dartmouth").bundles_sold, 27)
        order = FarmOrder.objects.get()
        self.assertEqual((order.status, order.payment, order.total), ("confirmed", "paid", 140))

        rows = {row["site"]: row for row in statements_for(2026)}
        self.assertEqual(rows["Dartmouth"]["owed_to_square_roots"], "187.50")  # 25 paid bundles x $7.50
        self.assertTrue(rows["Bedford"]["first_drop"])  # Bedford is new: first-drop price
        self.assertEqual(rows["Bedford"]["owed_to_square_roots"], "37.50")  # 10 x $3.75

    def test_missing_location_or_farm_is_explained(self):
        self.write("people", "first_name,email,role\nPriya,priya@example.com,Community Manager\nSam,sam@example.com,Farm")
        output = self.run_import()
        self.assertIn("Community Managers need a location", output)
        self.assertIn("Farm contacts need a farm", output)

    def test_future_drops_belong_in_drop_dates(self):
        self.write("past_drops", "drop_date,location,bundles_standard\n2099-01-01,Dartmouth,5")
        self.assertIn("This drop is in the future", self.run_import())
