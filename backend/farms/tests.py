from datetime import date, datetime, timedelta
from decimal import Decimal

from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Application, User
from drops.models import DropCycle
from .models import Farm, FarmOrder, FarmOrderLine, ProduceListing

PRODUCE = "/api/farm/produce/"
ORDERS = "/api/farm/orders/"


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


class FarmTestCase(TestCase):
    def setUp(self):
        self.farm = Farm.objects.create(name="Gaspereau Valley Growers")
        self.other_farm = Farm.objects.create(name="Canard Creek Farm")
        self.user = User.objects.create_user("farm.test", role=User.Role.FARM, farm=self.farm)
        self.client = client_for(self.user)
        self.cycle = DropCycle.objects.create(
            name="October 10 drop", drop_date=date(2026, 10, 10), order_cutoff=timezone.now() + timedelta(days=3)
        )

    def make_order(self, farm=None, **fields):
        """An order the team has already sent to the farm (pass sent_at=None for a draft)."""
        fields.setdefault("sent_at", timezone.now())
        order = FarmOrder.objects.create(
            farm=farm or self.farm, drop_cycle=self.cycle,
            pickup_at=timezone.make_aware(datetime(2026, 10, 9, 9)), **fields,
        )
        FarmOrderLine.objects.create(order=order, produce="Carrots", pounds=400, price_per_pound=Decimal("0.35"))
        FarmOrderLine.objects.create(order=order, produce="Beets", pounds=100, price_per_pound=Decimal("0.45"))
        return order


class ProduceTests(FarmTestCase):
    def post(self, **changes):
        form = {"produce": "carrots", "pounds": 600, "price_per_pound": "0.35", "available_until": "", "notes": ""}
        form.update(changes)
        return self.client.post(PRODUCE, form, format="json")

    def test_farm_can_post_produce(self):
        response = self.post()
        self.assertEqual(response.status_code, 201)
        listing = ProduceListing.objects.get()
        self.assertEqual(listing.farm, self.farm)
        self.assertEqual(listing.produce, "Carrots")  # first letter capitalised

    def test_farm_only_sees_its_own_produce(self):
        ProduceListing.objects.create(farm=self.other_farm, produce="Cabbage", pounds=10, price_per_pound=1)
        self.post()
        self.assertEqual([item["produce"] for item in self.client.get(PRODUCE).data], ["Carrots"])

    def test_cannot_edit_another_farms_produce(self):
        theirs = ProduceListing.objects.create(farm=self.other_farm, produce="Cabbage", pounds=10, price_per_pound=1)
        self.assertEqual(self.client.patch(f"{PRODUCE}{theirs.id}/", {"pounds": 1}, format="json").status_code, 404)

    def test_edit_and_mark_sold_out(self):
        listing_id = self.post().data["id"]
        self.client.patch(f"{PRODUCE}{listing_id}/", {"pounds": 250}, format="json")
        self.assertEqual(ProduceListing.objects.get().pounds, 250)
        self.assertEqual(self.client.delete(f"{PRODUCE}{listing_id}/").status_code, 204)
        self.assertEqual(self.client.get(PRODUCE).data, [])
        self.assertFalse(ProduceListing.objects.get().is_active)  # kept for the team's records

    def test_bad_values_are_explained(self):
        response = self.post(produce=" ", pounds=0, price_per_pound="0", available_until="2020-01-01")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"produce", "pounds", "price_per_pound", "available_until"})

    def test_error_messages_are_plain_language(self):
        response = self.post(pounds="lots", price_per_pound="cheap")
        self.assertEqual(response.data["pounds"], ["Enter a whole number of pounds, like 250."])
        self.assertEqual(response.data["price_per_pound"], ["Enter a price, like 0.35."])

    def test_other_roles_cannot_use_farm_screens(self):
        cm = client_for(User.objects.create_user("cm.test", role=User.Role.COMMUNITY_MANAGER))
        self.assertEqual(cm.get(PRODUCE).status_code, 403)
        self.assertEqual(cm.get(ORDERS).status_code, 403)

    def test_farm_user_without_a_farm_gets_a_clear_message(self):
        lonely = client_for(User.objects.create_user("farm.nofarm", role=User.Role.FARM))
        response = lonely.get(PRODUCE)
        self.assertEqual(response.status_code, 403)
        self.assertIn("isn't linked to a farm", response.data["detail"])


class PickupTests(FarmTestCase):
    def test_farm_sees_only_its_own_orders_with_totals(self):
        self.make_order()
        self.make_order(farm=self.other_farm)
        orders = self.client.get(ORDERS).data
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["total"], "185.00")  # 400 x 0.35 + 100 x 0.45
        self.assertEqual(orders[0]["lines"][0]["total"], "140.00")
        self.assertEqual(orders[0]["drop_cycle_name"], "October 10 drop")

    def test_farms_dont_see_draft_orders(self):
        draft = self.make_order(sent_at=None)
        self.assertEqual(self.client.get(ORDERS).data, [])
        self.assertEqual(self.client.post(f"{ORDERS}{draft.id}/confirm/").status_code, 404)

    def test_confirm_order_and_tell_the_team(self):
        order = self.make_order()
        response = self.client.post(f"{ORDERS}{order.id}/confirm/")
        self.assertEqual(response.data["status"], "confirmed")
        self.assertIsNotNone(response.data["responded_at"])
        self.assertEqual(len(mail.outbox), 1)

    def test_cant_fill_saves_the_farms_note(self):
        order = self.make_order()
        self.client.post(f"{ORDERS}{order.id}/cant-fill/", {"note": "Frost got the carrots"}, format="json")
        order.refresh_from_db()
        self.assertEqual(order.status, FarmOrder.Status.CANT_FILL)
        self.assertEqual(order.farm_note, "Frost got the carrots")

    def test_an_order_can_only_be_answered_once(self):
        order = self.make_order(status=FarmOrder.Status.CONFIRMED)
        self.assertEqual(self.client.post(f"{ORDERS}{order.id}/cant-fill/").status_code, 400)

    def test_cannot_answer_another_farms_order(self):
        order = self.make_order(farm=self.other_farm)
        self.assertEqual(self.client.post(f"{ORDERS}{order.id}/confirm/").status_code, 404)

    def test_marking_paid_records_the_date(self):
        order = self.make_order()
        order.payment = FarmOrder.Payment.PAID
        order.save()
        self.assertEqual(order.paid_on, timezone.localdate())


class FarmApprovalTests(TestCase):
    def test_approving_a_farm_sign_up_creates_its_farm(self):
        admin = client_for(User.objects.create_user("admin.test", role=User.Role.ADMIN))
        applicant = User.objects.create_user("apply.farm", role=User.Role.FARM, status=User.Status.PENDING)
        application = Application.objects.create(user=applicant, organization="North Mountain Market Garden", address="Kings County")
        admin.post(f"/api/applications/{application.id}/approve/")
        applicant.refresh_from_db()
        self.assertEqual(applicant.farm.name, "North Mountain Market Garden")
        self.assertEqual(applicant.farm.location, "Kings County")


class ExpiryAndPickupTests(FarmTestCase):
    def setUp(self):
        super().setUp()
        self.admin = client_for(User.objects.create_user("admin.test", role=User.Role.ADMIN))
        self.fresh = ProduceListing.objects.create(farm=self.farm, produce="Carrots", pounds=100, price_per_pound=1)
        self.old = ProduceListing.objects.create(
            farm=self.farm, produce="Old beets", pounds=100, price_per_pound=1, available_until=date.today() - timedelta(days=1)
        )

    def test_expired_produce_is_hidden_from_admins_and_cannot_be_bought(self):
        names = [l["produce"] for farm in self.admin.get("/api/admin/produce/").data for l in farm["listings"]]
        self.assertEqual(names, ["Carrots"])
        response = self.admin.post(f"/api/admin/cycles/{self.cycle.id}/buy/", {"listing": self.old.id, "pounds": 10}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_farm_still_sees_its_expired_produce_marked_as_expired(self):
        listed = {l["produce"]: l["expired"] for l in self.client.get(PRODUCE).data}
        self.assertEqual(listed, {"Carrots": False, "Old beets": True})

    def test_admin_can_change_pickup_and_the_farm_is_told(self):
        self.user.email = "ruth@example.com"
        self.user.save()
        order = self.make_order()
        new_time = (timezone.now() + timedelta(days=5)).replace(microsecond=0)
        response = self.admin.patch(
            f"/api/admin/farm-orders/{order.id}/", {"pickup_at": new_time.isoformat(), "pickup_notes": "Side door"}, format="json"
        )
        self.assertEqual(response.data["pickup_notes"], "Side door")
        self.assertIn("Pickup changed", mail.outbox[-1].subject)
        past = self.admin.patch(f"/api/admin/farm-orders/{order.id}/", {"pickup_at": "2020-01-01T09:00:00Z"}, format="json")
        self.assertIn("pickup_at", past.data)
