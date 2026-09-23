from datetime import datetime, time, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from farms.models import Farm, FarmOrder, FarmOrderLine, ProduceListing
from .models import BundleOrder, DropCycle, DropReport, Preorder, Site, SiteDrop


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def make_drop(site, days_from_now, cutoff_days_from_now=None):
    """A cycle and a site drop `days_from_now` days away (negative = in the past)."""
    drop_date = timezone.localdate() + timedelta(days=days_from_now)
    if cutoff_days_from_now is None:
        cutoff_days_from_now = days_from_now - 4
    cutoff = timezone.now() + timedelta(days=cutoff_days_from_now)
    cycle, _ = DropCycle.objects.get_or_create(
        drop_date=drop_date, defaults={"name": f"Drop {drop_date}", "order_cutoff": cutoff}
    )
    return SiteDrop.objects.create(cycle=cycle, site=site, drop_date=drop_date, order_cutoff=cutoff)


class DropTestCase(TestCase):
    def setUp(self):
        self.site = Site.objects.create(name="Dartmouth", address="105 Highfield Park Dr")
        self.other_site = Site.objects.create(name="Windsor", address="613 King St")
        self.manager = User.objects.create_user("cm.test", role=User.Role.COMMUNITY_MANAGER, site=self.site)
        self.admin = User.objects.create_user("admin.test", role=User.Role.ADMIN, first_name="Maya")
        self.cm = client_for(self.manager)
        self.team = client_for(self.admin)


class ManagerOrderTests(DropTestCase):
    def test_order_before_cutoff_and_change_it(self):
        drop = make_drop(self.site, 10)
        self.assertEqual(self.cm.put(f"/api/manager/drops/{drop.id}/order/", {"bundles": 20}, format="json").data["bundles"], 20)
        self.cm.put(f"/api/manager/drops/{drop.id}/order/", {"bundles": 24}, format="json")
        self.assertEqual(BundleOrder.objects.get().bundles, 24)

    def test_ordering_is_locked_after_the_cutoff(self):
        drop = make_drop(self.site, 3, cutoff_days_from_now=-1)
        response = self.cm.put(f"/api/manager/drops/{drop.id}/order/", {"bundles": 20}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("closed", response.data["detail"])

    def test_silly_numbers_are_refused(self):
        drop = make_drop(self.site, 10)
        self.assertEqual(self.cm.put(f"/api/manager/drops/{drop.id}/order/", {"bundles": 2000}, format="json").status_code, 400)
        self.assertEqual(self.cm.put(f"/api/manager/drops/{drop.id}/order/", {"bundles": "lots"}, format="json").status_code, 400)

    def test_managers_only_see_and_order_for_their_own_site(self):
        mine = make_drop(self.site, 10)
        theirs = make_drop(self.other_site, 10)
        self.assertEqual([d["id"] for d in self.cm.get("/api/manager/drops/").data], [mine.id])
        self.assertEqual(self.cm.put(f"/api/manager/drops/{theirs.id}/order/", {"bundles": 5}, format="json").status_code, 404)

    def test_manager_without_a_site_gets_a_clear_message(self):
        lonely = client_for(User.objects.create_user("cm.nosite", role=User.Role.COMMUNITY_MANAGER))
        response = lonely.get("/api/manager/drops/")
        self.assertEqual(response.status_code, 403)
        self.assertIn("isn't linked to a location", response.data["detail"])


class PreorderTests(DropTestCase):
    def test_add_tick_off_and_remove_preorders(self):
        drop = make_drop(self.site, 5)
        created = self.cm.post(f"/api/manager/drops/{drop.id}/preorders/", {"customer_name": " Alex B. ", "bundles": 2}, format="json")
        self.assertEqual(created.data["customer_name"], "Alex B.")
        self.cm.patch(f"/api/manager/preorders/{created.data['id']}/", {"paid": True, "picked_up": True}, format="json")
        listed = self.cm.get("/api/manager/drops/").data[0]
        self.assertEqual((listed["preorder_count"], listed["preorder_bundles"], listed["picked_up_count"]), (1, 2, 1))
        self.cm.delete(f"/api/manager/preorders/{created.data['id']}/")
        self.assertFalse(Preorder.objects.exists())

    def test_cannot_touch_another_sites_preorders(self):
        theirs = Preorder.objects.create(site_drop=make_drop(self.other_site, 5), customer_name="Sam")
        self.assertEqual(self.cm.patch(f"/api/manager/preorders/{theirs.id}/", {"paid": True}, format="json").status_code, 404)

    def test_preorder_needs_a_name(self):
        drop = make_drop(self.site, 5)
        response = self.cm.post(f"/api/manager/drops/{drop.id}/preorders/", {"customer_name": ""}, format="json")
        self.assertEqual(response.data["customer_name"], ["Please add the customer's name."])


class DropReportTests(DropTestCase):
    def test_log_a_drop_after_it_happens(self):
        drop = make_drop(self.site, -2)
        form = {"bundles_sold": 22, "bundles_left_over": 2, "leftovers_went_to": "donated", "notes": "Busy day"}
        response = self.cm.put(f"/api/manager/drops/{drop.id}/report/", form, format="json")
        self.assertEqual(response.data["report"]["leftovers_label"], "Donated")
        # Saving again updates the same report.
        self.cm.put(f"/api/manager/drops/{drop.id}/report/", {**form, "bundles_sold": 23}, format="json")
        self.assertEqual(DropReport.objects.get().bundles_sold, 23)

    def test_cannot_log_a_drop_before_it_happens(self):
        drop = make_drop(self.site, 3)
        response = self.cm.put(f"/api/manager/drops/{drop.id}/report/", {"bundles_sold": 5}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_leftovers_need_a_destination(self):
        drop = make_drop(self.site, -2)
        form = {"bundles_sold": 20, "bundles_left_over": 3, "leftovers_went_to": "none"}
        response = self.cm.put(f"/api/manager/drops/{drop.id}/report/", form, format="json")
        self.assertIn("leftovers_went_to", response.data)


class AdminCycleTests(DropTestCase):
    def new_cycle(self, **changes):
        drop_date = timezone.localdate() + timedelta(days=14)
        form = {
            "drop_date": drop_date.isoformat(),
            "order_cutoff": timezone.make_aware(datetime.combine(drop_date - timedelta(days=4), time(17))).isoformat(),
            "sites": [self.site.id, self.other_site.id],
        }
        form.update(changes)
        return self.team.post("/api/admin/cycles/", form, format="json")

    def test_create_a_cycle_for_chosen_sites(self):
        response = self.new_cycle()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["site_count"], 2)
        self.assertTrue(response.data["name"].endswith("drop"))

    def test_cycle_checks_are_explained(self):
        past = (timezone.localdate() - timedelta(days=1)).isoformat()
        self.assertIn("drop_date", self.new_cycle(drop_date=past).data)
        self.assertIn("sites", self.new_cycle(sites=[]).data)
        late_cutoff = timezone.make_aware(datetime.combine(timezone.localdate() + timedelta(days=20), time(9))).isoformat()
        self.assertIn("order_cutoff", self.new_cycle(order_cutoff=late_cutoff).data)

    def test_detail_shows_orders_pounds_needed_and_farm_orders(self):
        drop = make_drop(self.site, 10)
        BundleOrder.objects.create(site_drop=drop, bundles=20)
        farm = Farm.objects.create(name="Canard Creek Farm")
        order = FarmOrder.objects.create(farm=farm, drop_cycle=drop.cycle, pickup_at=timezone.now() + timedelta(days=9))
        FarmOrderLine.objects.create(order=order, produce="Cabbage", pounds=150, price_per_pound=Decimal("0.40"))
        detail = self.team.get(f"/api/admin/cycles/{drop.cycle.id}/").data
        self.assertEqual((detail["pounds_needed"], detail["pounds_bought"]), (200, 150))
        self.assertEqual(detail["farm_orders"][0]["farm_name"], "Canard Creek Farm")
        self.assertEqual([s["name"] for s in detail["other_sites"]], ["Windsor"])

    def test_change_one_sites_date_and_remove_a_site(self):
        drop = make_drop(self.site, 10)
        new_date = (drop.drop_date + timedelta(days=1)).isoformat()
        self.team.patch(f"/api/admin/site-drops/{drop.id}/", {"drop_date": new_date}, format="json")
        drop.refresh_from_db()
        self.assertEqual(drop.drop_date.isoformat(), new_date)
        self.team.delete(f"/api/admin/site-drops/{drop.id}/")
        self.assertFalse(SiteDrop.objects.exists())

    def test_cannot_delete_a_cycle_with_orders(self):
        drop = make_drop(self.site, 10)
        BundleOrder.objects.create(site_drop=drop, bundles=5)
        self.assertEqual(self.team.delete(f"/api/admin/cycles/{drop.cycle.id}/").status_code, 400)

    def test_only_admins(self):
        self.assertEqual(self.cm.get("/api/admin/cycles/").status_code, 403)
        self.assertEqual(self.cm.get("/api/admin/impact/").status_code, 403)


class BuyProduceTests(DropTestCase):
    def setUp(self):
        super().setUp()
        self.farm = Farm.objects.create(name="Canard Creek Farm", pickup_notes="Cold storage barn")
        self.listing = ProduceListing.objects.create(farm=self.farm, produce="Cabbage", pounds=400, price_per_pound=Decimal("0.40"))
        self.drop = make_drop(self.site, 10)

    def buy(self, pounds):
        return self.team.post(f"/api/admin/cycles/{self.drop.cycle.id}/buy/", {"listing": self.listing.id, "pounds": pounds}, format="json")

    def test_buying_creates_the_farm_order_and_takes_pounds_off_the_listing(self):
        response = self.buy(150)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["pickup_notes"], "Cold storage barn")
        self.buy(50)  # same listing again: adds to the same line
        self.assertEqual(FarmOrderLine.objects.get().pounds, 200)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.pounds, 200)

    def test_cannot_buy_more_than_the_farm_has(self):
        self.assertEqual(self.buy(401).status_code, 400)

    def test_adding_to_a_confirmed_order_asks_the_farm_again(self):
        self.buy(100)
        FarmOrder.objects.update(status=FarmOrder.Status.CONFIRMED)
        self.buy(100)
        self.assertEqual(FarmOrder.objects.get().status, FarmOrder.Status.WAITING)

    def test_removing_a_line_gives_the_pounds_back(self):
        self.buy(400)
        self.listing.refresh_from_db()
        self.assertFalse(self.listing.is_active)  # all bought, so it's sold out
        line = FarmOrderLine.objects.get()
        self.assertEqual(self.team.delete(f"/api/admin/farm-order-lines/{line.id}/").status_code, 204)
        self.listing.refresh_from_db()
        self.assertEqual((self.listing.pounds, self.listing.is_active), (400, True))
        self.assertFalse(FarmOrder.objects.exists())  # empty orders are removed

    def test_mark_paid_only_after_the_farm_confirms(self):
        order = FarmOrder.objects.get(pk=self.buy(100).data["id"])
        self.assertEqual(self.team.post(f"/api/admin/farm-orders/{order.id}/paid/").status_code, 400)
        FarmOrder.objects.update(status=FarmOrder.Status.CONFIRMED)
        self.assertEqual(self.team.post(f"/api/admin/farm-orders/{order.id}/paid/").data["payment"], "paid")


class ImpactTests(DropTestCase):
    def test_impact_numbers_and_csv(self):
        drop = make_drop(self.site, -3)
        BundleOrder.objects.create(site_drop=drop, bundles=25)
        DropReport.objects.create(site_drop=drop, bundles_sold=23, bundles_left_over=2, leftovers_went_to="donated")
        farm = Farm.objects.create(name="Canard Creek Farm")
        order = FarmOrder.objects.create(
            farm=farm, drop_cycle=drop.cycle, pickup_at=timezone.now() - timedelta(days=4), status=FarmOrder.Status.CONFIRMED
        )
        FarmOrderLine.objects.create(order=order, produce="Cabbage", pounds=260, price_per_pound=Decimal("0.40"))

        totals = self.team.get("/api/admin/impact/").data["totals"]
        self.assertEqual((totals["pounds_diverted"], totals["bundles_sold"], totals["sites_active"]), (260, 23, 1))

        csv_response = self.team.get("/api/admin/impact.csv")
        self.assertEqual(csv_response["Content-Type"], "text/csv")
        lines = csv_response.content.decode().strip().splitlines()
        self.assertEqual(lines[0].split(",")[:3], ["Drop date", "Drop cycle", "Location"])
        self.assertIn("Dartmouth,25,23,2,Donated,230", lines[1])


class HostAndPublicTests(DropTestCase):
    def test_host_sees_drops_at_their_space_and_who_runs_them(self):
        self.manager.first_name, self.manager.phone = "Jordan", "902-555-0123"
        self.manager.save()
        host = client_for(User.objects.create_user("host.test", role=User.Role.HOST_SITE, site=self.site))
        make_drop(self.site, 10)
        make_drop(self.other_site, 10)
        data = host.get("/api/host/drops/").data
        self.assertEqual(len(data["drops"]), 1)
        self.assertEqual(data["managers"][0]["phone"], "902-555-0123")

    def test_public_drop_dates(self):
        make_drop(self.site, 10)
        data = APIClient().get("/api/drop-dates/").data
        self.assertEqual(data["next"], timezone.localdate() + timedelta(days=10))
