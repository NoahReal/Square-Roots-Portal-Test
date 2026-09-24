from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient

from .models import Preorder, StandingReservation, WaitlistEntry
from .reservations import apply_standing
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


class PayItForwardTests(ReserveTestCase):
    def test_gift_is_added_to_what_you_pay_and_counted_for_free_bundles(self):
        response = self.reserve(pay_it_forward="5")
        self.assertEqual(response.data["amount_due"], "15.00")  # $10 bundle + $5 gift
        money = self.public.get("/api/reserve/options/").data["money"]
        self.assertEqual(money["pay_it_forward_this_year"], "5.00")
        self.assertEqual(money["free_bundles_covered"], 0)  # a free bundle needs $7.50
        self.reserve(email="sam@example.com", pay_it_forward="10")
        self.assertEqual(self.public.get("/api/reserve/options/").data["money"]["free_bundles_covered"], 2)

    def test_where_the_money_goes(self):
        money = self.public.get("/api/reserve/options/").data["money"]
        self.assertEqual((money["standard"], money["to_square_roots"], money["to_manager"]), ("10.00", "7.50", "2.50"))
        self.assertIsNone(money["to_farms"])  # no farm purchases or sales logged yet

    def test_gifts_are_capped(self):
        self.assertEqual(self.reserve(pay_it_forward="500").status_code, 400)


class EveryDropTests(ReserveTestCase):
    def test_reserving_every_drop_covers_drops_already_scheduled_and_new_ones(self):
        later = make_drop(self.site, 24)
        first = self.reserve(every_drop=True, bundles=2).data
        self.assertTrue(first["every_drop"])
        self.assertEqual(Preorder.objects.filter(site_drop=later).count(), 1)  # the next one too

        mail.outbox.clear()
        response = self.team.post(
            "/api/admin/cycles/",
            {"drop_date": str(later.drop_date + timedelta(days=14)), "order_cutoff": (later.order_cutoff + timedelta(days=14)).isoformat(),
             "sites": [self.site.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        newest = Preorder.objects.filter(site_drop__cycle_id=response.data["id"]).get()
        self.assertEqual((newest.bundles, newest.customer_name), (2, "Alex B."))
        self.assertIn("reserved your next bundle", mail.outbox[0].subject)

    def test_changes_carry_forward_and_stopping_keeps_existing_reservations(self):
        token = self.reserve(every_drop=True).data["token"]
        self.public.patch(f"/api/reserve/{token}/", {"bundles": 3}, format="json")
        self.assertEqual(StandingReservation.objects.get().bundles, 3)
        response = self.public.delete(f"/api/reserve/{token}/every-drop/")
        self.assertFalse(response.data["every_drop"])
        self.assertFalse(StandingReservation.objects.exists())
        self.assertEqual(Preorder.objects.count(), 1)

    def test_start_every_drop_from_an_existing_reservation(self):
        token = self.reserve().data["token"]
        self.assertTrue(self.public.post(f"/api/reserve/{token}/every-drop/").data["every_drop"])

    def test_full_drops_put_every_drop_customers_on_the_waitlist(self):
        self.reserve(every_drop=True, bundles=2)
        self.site.reservation_limit = 1
        self.site.save()
        later = make_drop(self.site, 24)
        apply_standing(later, "http://testserver")
        self.assertEqual(later.waitlist.count(), 1)


class NoticeTests(ReserveTestCase):
    def test_moving_a_drop_emails_customers(self):
        self.reserve()
        mail.outbox.clear()
        response = self.team.patch(f"/api/admin/site-drops/{self.drop.id}/", {"starts_at": "14:00", "ends_at": "16:00"}, format="json")
        self.assertEqual(response.data["customers_emailed"], 1)
        self.assertIn("has changed", mail.outbox[0].subject)
        self.assertIn("2:00 p.m.", mail.outbox[0].body)

    def test_changing_only_the_cutoff_sends_nothing(self):
        self.reserve()
        mail.outbox.clear()
        cutoff = (self.drop.order_cutoff - timedelta(days=1)).isoformat()
        self.team.patch(f"/api/admin/site-drops/{self.drop.id}/", {"order_cutoff": cutoff}, format="json")
        self.assertEqual(len(mail.outbox), 0)

    def test_cancelling_a_drop_emails_customers(self):
        self.reserve()
        mail.outbox.clear()
        self.team.delete(f"/api/admin/site-drops/{self.drop.id}/")
        self.assertIn("cancelled", mail.outbox[0].subject)

    def test_manager_messages_customers_and_hears_who_has_no_email(self):
        self.reserve()
        self.reserve(email="", phone="902-555-0199", customer_name="Pat D.")
        mail.outbox.clear()
        response = self.cm.post(f"/api/manager/drops/{self.drop.id}/message/", {"message": "We're moving indoors."}, format="json")
        self.assertEqual(response.data["emailed"], 1)
        self.assertEqual(response.data["phone_only"], [{"customer_name": "Pat D.", "phone": "902-555-0199"}])
        self.assertIn("moving indoors", mail.outbox[0].body)
        self.assertEqual(self.cm.post(f"/api/manager/drops/{self.drop.id}/message/", {"message": " "}, format="json").status_code, 400)


class FrenchTests(ReserveTestCase):
    def test_french_customers_get_french_emails(self):
        self.reserve(language="fr", bundles=2, pay_it_forward="2.50")
        email = mail.outbox[0]
        self.assertEqual(email.subject, "[Square Roots] Votre panier est réservé")
        self.assertIn("Bonjour Alex B.", email.body)
        self.assertIn("2 paniers", email.body)
        self.assertIn("22,50 $", email.body)
        self.assertIn(" h", email.body)  # times like "11 h"

    def test_notices_use_each_customers_language(self):
        self.reserve(language="fr")
        self.reserve(email="sam@example.com")
        mail.outbox.clear()
        self.team.delete(f"/api/admin/site-drops/{self.drop.id}/")
        by_person = {m.to[0]: m.subject for m in mail.outbox}
        self.assertIn("annulée", by_person["alex@example.com"])
        self.assertIn("cancelled", by_person["sam@example.com"])


class BundleContentsTests(ReserveTestCase):
    def setUp(self):
        super().setUp()
        from django.utils import timezone
        from farms.models import Farm, FarmOrder, FarmOrderLine
        from .models import BundleOrder

        BundleOrder.objects.create(site_drop=self.drop, bundles=20)
        farm = Farm.objects.create(name="Canard Creek Farm", location="Canard")
        self.order = FarmOrder.objects.create(farm=farm, drop_cycle=self.drop.cycle, pickup_at=timezone.now())
        FarmOrderLine.objects.create(order=self.order, produce="Carrots", pounds=50, price_per_pound="0.35")
        FarmOrderLine.objects.create(order=self.order, produce="Apples", pounds=30, price_per_pound="0.55")
        self.timezone = timezone

    def test_nothing_is_shown_until_the_farm_orders_are_sent(self):
        self.assertEqual(self.reserve().data["bundle"], [])
        self.assertEqual(self.public.get("/api/bundle/").data["items"], [])

    def test_items_with_their_farms_and_pounds_per_bundle(self):
        self.order.sent_at = self.timezone.now()
        self.order.save()
        items = self.public.get("/api/bundle/").data["items"]
        self.assertEqual(items[0], {"produce": "Carrots", "pounds_per_bundle": 2.5, "farms": [{"name": "Canard Creek Farm", "location": "Canard"}]})
        self.assertEqual(items[1]["pounds_per_bundle"], 1.5)


class HostReservationTests(ReserveTestCase):
    def setUp(self):
        super().setUp()
        from accounts.models import User
        from .tests import client_for

        self.host_user = User.objects.create_user("host.test", role=User.Role.HOST_SITE, site=self.site)
        self.host = client_for(self.host_user)

    def test_host_reserves_for_someone_without_contact_details(self):
        response = self.host.post(
            "/api/host/reservations/", {"site_drop": self.drop.id, "customer_name": "M.K.", "bundles": 2, "price_tier": "free"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["amount_due"], "0.00")
        preorder = Preorder.objects.get()
        self.assertEqual((preorder.source, preorder.reserved_by, preorder.email), ("host", self.host_user, ""))
        listed = self.host.get("/api/host/reservations/").data["drops"][0]
        self.assertEqual((listed["bundles_left"], listed["reservations"][0]["pickup_code"]), (3, preorder.pickup_code))
        # It's on the Community Manager's list like any other reservation.
        self.assertEqual(self.cm.get(f"/api/manager/drops/{self.drop.id}/preorders/").data[0]["source"], "host")

    def test_host_cannot_go_over_what_is_left_or_use_another_location(self):
        response = self.host.post(
            "/api/host/reservations/", {"site_drop": self.drop.id, "customer_name": "A", "bundles": 4, "price_tier": "free"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        response = self.host.post(
            "/api/host/reservations/", {"site_drop": self.drop.id, "customer_name": "B", "bundles": 2, "price_tier": "free"}, format="json"
        )
        self.assertIn("Only 1 bundle is left", str(response.data["bundles"]))
        other = make_drop(self.other_site, 10)
        response = self.host.post(
            "/api/host/reservations/", {"site_drop": other.id, "customer_name": "C", "bundles": 1, "price_tier": "free"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_host_cancels_and_the_waitlist_moves_up(self):
        made = self.host.post(
            "/api/host/reservations/", {"site_drop": self.drop.id, "customer_name": "A", "bundles": 5, "price_tier": "free"}, format="json"
        )
        self.assertEqual(made.status_code, 400)  # over the per-person limit
        made = self.host.post(
            "/api/host/reservations/", {"site_drop": self.drop.id, "customer_name": "A", "bundles": 4, "price_tier": "free"}, format="json"
        ).data
        self.reserve(bundles=3, join_waitlist=True)
        self.host.delete(f"/api/host/reservations/{made['id']}/")
        self.assertEqual(Preorder.objects.get().customer_name, "Alex B.")


class ForgetOldDetailsTests(ReserveTestCase):
    def test_details_are_removed_60_days_after_the_drop(self):
        from io import StringIO

        from django.core.management import call_command

        old = make_drop(self.site, -61, cutoff_days_from_now=-65)
        Preorder.objects.create(site_drop=old, customer_name="Alex B.", email="alex@example.com", phone="902-555-0100", paid=True)
        self.reserve()  # an upcoming reservation stays as it is
        call_command("forget_old_details", stdout=StringIO())
        forgotten = Preorder.objects.get(site_drop=old)
        self.assertEqual((forgotten.customer_name, forgotten.email, forgotten.phone, forgotten.paid), ("Customer (details removed)", "", "", True))
        self.assertEqual(Preorder.objects.get(site_drop=self.drop).email, "alex@example.com")
