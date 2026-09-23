from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient

from .models import Preorder, WaitlistEntry
from .tests import DropTestCase, make_drop


class ReserveTestCase(DropTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()  # the rate limit counts requests in the cache
        self.site.online_reservations = True
        self.site.reservation_limit = 5
        self.site.delivery_partner = "BayRides"
        self.site.save()
        self.drop = make_drop(self.site, 10)
        self.public = APIClient()

    def reserve(self, **changes):
        data = {
            "site_drop": self.drop.id, "customer_name": "Alex B.", "email": "alex@example.com",
            "bundles": 1, "price_tier": "standard", **changes,
        }
        return self.public.post("/api/reserve/", data, format="json")


class ReservingTests(ReserveTestCase):
    def test_reserve_and_get_a_pickup_code_and_email(self):
        response = self.reserve(bundles=2, price_tier="at_cost")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "reserved")
        self.assertEqual(len(response.data["pickup_code"]), 4)
        self.assertEqual(response.data["amount_due"], "15.00")  # 2 x $7.50
        preorder = Preorder.objects.get()
        self.assertEqual(preorder.source, "online")
        self.assertIn(preorder.pickup_code, mail.outbox[0].body)
        self.assertIn(f"/reserve/manage/{preorder.manage_token}", mail.outbox[0].body)

    def test_free_bundles_with_delivery_only_pay_the_delivery_fee(self):
        response = self.reserve(price_tier="free", delivery=True, delivery_address="12 Main St")
        self.assertEqual(response.data["amount_due"], "1.99")

    def test_needs_a_way_to_reach_you(self):
        response = self.reserve(email="", phone="")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email or a phone number", str(response.data["email"]))
        self.assertEqual(self.reserve(email="", phone="902-555-0123").status_code, 201)

    def test_one_reservation_per_person_per_drop(self):
        self.reserve(phone="902-555-0123")
        response = self.reserve(email="other@example.com", phone="(902) 555 0123")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already have a reservation", response.data["detail"])

    def test_closed_drops_and_locations_without_online_reservations_are_refused(self):
        closed = make_drop(self.site, 3, cutoff_days_from_now=-1)
        self.assertIn("closed", str(self.reserve(site_drop=closed.id).data["site_drop"]))
        other = make_drop(self.other_site, 10)
        self.assertIn("doesn't take online reservations", str(self.reserve(site_drop=other.id).data["site_drop"]))

    def test_too_many_bundles_or_the_spam_trap_are_refused(self):
        self.assertEqual(self.reserve(bundles=5).status_code, 400)
        self.assertEqual(self.reserve(website="http://spam.example").status_code, 400)
        self.assertFalse(Preorder.objects.exists())

    def test_options_show_what_is_left(self):
        self.reserve(bundles=3)
        sites = {s["name"]: s for s in self.public.get("/api/reserve/options/").data["sites"]}
        self.assertEqual(sites["Dartmouth"]["drops"][0]["bundles_left"], 2)
        self.assertEqual(sites["Windsor"]["drops"], [])  # online reservations are off there


class WaitlistTests(ReserveTestCase):
    def test_full_drop_offers_the_waitlist_then_a_cancellation_lets_the_next_person_in(self):
        first = self.reserve(bundles=4).data
        response = self.reserve(email="sam@example.com", bundles=2)
        self.assertEqual(response.status_code, 409)
        self.assertIn("Only 1 bundle is left", response.data["detail"])

        waiting = self.reserve(email="sam@example.com", bundles=2, join_waitlist=True).data
        self.assertEqual((waiting["status"], waiting["waitlist_position"]), ("waitlisted", 1))

        mail.outbox.clear()
        self.assertEqual(self.public.delete(f"/api/reserve/{first['token']}/").status_code, 200)
        # Sam's link now opens a real reservation, and Sam got an email saying so.
        now = self.public.get(f"/api/reserve/{waiting['token']}/").data
        self.assertEqual(now["status"], "reserved")
        self.assertFalse(WaitlistEntry.objects.exists())
        self.assertIn("opened up", mail.outbox[0].subject)

    def test_a_community_manager_removing_a_preorder_also_frees_a_spot(self):
        self.reserve(bundles=4)
        self.reserve(email="sam@example.com", bundles=1)
        self.reserve(email="jo@example.com", bundles=1, join_waitlist=True)
        sam = Preorder.objects.get(email="sam@example.com")
        self.cm.delete(f"/api/manager/preorders/{sam.id}/")
        self.assertTrue(Preorder.objects.filter(email="jo@example.com").exists())


class ManagingTests(ReserveTestCase):
    def test_change_bundles_and_price_until_the_cutoff(self):
        token = self.reserve().data["token"]
        response = self.public.patch(f"/api/reserve/{token}/", {"bundles": 2, "price_tier": "free"}, format="json")
        self.assertEqual((response.data["bundles"], response.data["amount_due"]), (2, "0.00"))
        self.assertEqual(self.public.patch(f"/api/reserve/{token}/", {"bundles": 9}, format="json").status_code, 400)

        self.drop.order_cutoff = self.drop.order_cutoff.replace(year=2000)
        self.drop.save()
        response = self.public.patch(f"/api/reserve/{token}/", {"bundles": 1}, format="json")
        self.assertIn("closed", response.data["detail"])
        self.assertFalse(self.public.get(f"/api/reserve/{token}/").data["can_change"])

    def test_cannot_add_more_than_is_left(self):
        token = self.reserve(bundles=4).data["token"]
        self.reserve(email="sam@example.com", bundles=1)
        response = self.public.patch(f"/api/reserve/{token}/", {"bundles": 4}, format="json")
        self.assertEqual(response.status_code, 200)  # no change in size is fine
        response = self.public.patch(f"/api/reserve/{token}/", {"bundles": 5}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_cancelling_removes_the_customer_details(self):
        token = self.reserve().data["token"]
        self.public.delete(f"/api/reserve/{token}/")
        self.assertFalse(Preorder.objects.exists())
        self.assertEqual(self.public.get(f"/api/reserve/{token}/").status_code, 404)

    def test_a_wrong_link_explains_itself(self):
        response = self.public.get("/api/reserve/not-a-real-token/")
        self.assertEqual(response.status_code, 404)
        self.assertIn("couldn't find", response.data["detail"])


class ManagerSideTests(ReserveTestCase):
    def test_online_reservations_appear_in_the_preorder_list_with_their_code(self):
        code = self.reserve().data["pickup_code"]
        rows = self.cm.get(f"/api/manager/drops/{self.drop.id}/preorders/").data
        self.assertEqual((rows[0]["source"], rows[0]["pickup_code"]), ("online", code))

    def test_pickup_code_lookup(self):
        code = self.reserve(bundles=2).data["pickup_code"]
        found = self.cm.get(f"/api/manager/drops/{self.drop.id}/pickup/{code.lower()}/")
        self.assertEqual((found.data["customer_name"], found.data["amount_due"]), ("Alex B.", "20.00"))
        missing = self.cm.get(f"/api/manager/drops/{self.drop.id}/pickup/ZZZZ/")
        self.assertEqual(missing.status_code, 404)

    def test_preorders_added_by_the_manager_get_codes_too(self):
        self.cm.post(f"/api/manager/drops/{self.drop.id}/preorders/", {"customer_name": "Pat D.", "bundles": 1}, format="json")
        self.assertEqual(len(Preorder.objects.get().pickup_code), 4)

    def test_manager_turns_reservations_off_and_raising_the_limit_clears_the_waitlist(self):
        self.reserve(bundles=4)
        self.reserve(email="sam@example.com", bundles=3, join_waitlist=True)
        self.cm.patch("/api/manager/reservations/", {"reservation_limit": 10}, format="json")
        self.assertTrue(Preorder.objects.filter(email="sam@example.com").exists())

        self.cm.patch("/api/manager/reservations/", {"online_reservations": False}, format="json")
        self.assertIn("doesn't take online reservations", str(self.reserve(email="jo@example.com").data["site_drop"]))
