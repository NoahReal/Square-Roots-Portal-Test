from datetime import timedelta
from decimal import Decimal

from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from drops.models import DropCycle, DropOffPoint, Route, Site, SiteDrop
from farms.models import Farm
from .models import Confirmation, OrderForm
from .price_lists import read_rows

KETTYS_LIST = """Product\tBox size\tPrice per box\tBoxes available
Carrots\t50 lb\t$22.00\t40
Beets\t25 lb\t18.50\t
Green cabbage\t50 lb\t20\t12"""


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


class PriceListReadingTests(TestCase):
    def test_rows_pasted_from_a_spreadsheet(self):
        items, problems = read_rows(KETTYS_LIST)
        self.assertEqual(problems, [])
        self.assertEqual(items[0], {"product": "Carrots", "box_size": "50 lb", "price": Decimal("22.00"), "available": 40, "notes": ""})
        self.assertIsNone(items[1]["available"])

    def test_csv_without_a_header_and_problems_by_row(self):
        items, problems = read_rows('Apples,40 lb,"1,025.00"\nOnions,50 lb,cheap\n,10 lb,4')
        self.assertEqual(items[0]["price"], Decimal("1025.00"))
        self.assertEqual(problems, ["Row 2 (Onions): “cheap” isn't a price. Use a number like 22.50.", "Row 3: there's no product name."])


class OrderingTestCase(TestCase):
    def setUp(self):
        self.kettys = Farm.objects.create(name="Ketty Brow's Wholesale Limited", kind="wholesaler", contact_email="orders@kettys.example")
        self.footes = Farm.objects.create(name="Footes Family Farm", kind="farm", contact_email="footes@example.com")
        self.halifax = Route.objects.create(name="Halifax", form_sent_on=0, orders_due_on=1, trucks_on=4, uses_order_forms=True)
        self.halifax.suppliers.set([self.kettys, self.footes])
        self.hub = DropOffPoint.objects.create(route=self.halifax, name="Fairview hub", hub_share_percent=10, hub_share_supplier=self.kettys)
        self.fairview = Site.objects.create(name="Fairview", address="50 Gesner St", route=self.halifax, drop_off=self.hub)
        self.hub.hub_site = self.fairview
        self.hub.save()
        self.north_end = Site.objects.create(name="North End", address="5522 Russell St", route=self.halifax, drop_off=self.hub)
        own = DropOffPoint.objects.create(route=self.halifax, name="Upper Tantallon")
        self.tantallon = Site.objects.create(name="Upper Tantallon", address="5374 St Margarets Bay Rd", route=self.halifax, drop_off=own)

        market = timezone.localdate() + timedelta(days=(5 - timezone.localdate().weekday()) % 7 + 14)  # a Saturday 2-3 weeks out
        self.cycle = DropCycle.objects.create(name="Test drop", drop_date=market, order_cutoff=timezone.now() + timedelta(days=10))

        self.admin = User.objects.create_user("admin.test", role=User.Role.ADMIN)
        self.team = client_for(self.admin)
        self.cm = User.objects.create_user("cm.test", role=User.Role.COMMUNITY_MANAGER, site=self.north_end, email="cm@example.com")
        self.manager = client_for(self.cm)
        self.fairview_cm = User.objects.create_user("cm.fairview", role=User.Role.COMMUNITY_MANAGER, site=self.fairview)

    def add_price_lists(self):
        self.team.post("/api/admin/price-lists/", {"supplier": self.kettys.id, "cycle": self.cycle.id, "text": KETTYS_LIST}, format="json")
        self.team.post("/api/admin/price-lists/", {"supplier": self.footes.id, "cycle": self.cycle.id, "text": "Apples\t40 lb\t30"}, format="json")

    def open_form(self):
        self.add_price_lists()
        form = self.team.post("/api/admin/order-forms/", {"cycle": self.cycle.id, "routes": [self.halifax.id]}, format="json").data
        for price_item in form["price_items"]:
            form = self.team.post(f"/api/admin/order-forms/{form['id']}/items/", {"price_item": price_item["id"]}, format="json").data
        self.team.post(f"/api/admin/order-forms/{form['id']}/publish/", format="json")
        return form

    def order(self, client, form, wanted):
        items = {i["product"]: i["id"] for i in form["items"]}
        return client.put(f"/api/manager/order-forms/{form['id']}/order/", {"lines": {items[p]: n for p, n in wanted.items()}}, format="json")


class PriceListTests(OrderingTestCase):
    def test_changes_since_the_last_list(self):
        earlier = DropCycle.objects.create(name="Earlier", drop_date=self.cycle.drop_date - timedelta(days=14), order_cutoff=timezone.now())
        self.team.post("/api/admin/price-lists/", {"supplier": self.kettys.id, "cycle": earlier.id, "text": "Carrots\t50 lb\t20\nTurnips\t50 lb\t15\nBeets\t25 lb\t18.50"}, format="json")
        self.add_price_lists()
        kettys = next(s for s in self.team.get(f"/api/admin/price-lists/?cycle={self.cycle.id}").data["suppliers"] if s["id"] == self.kettys.id)
        changes = {i["product"]: (i["change"], i["old_price"]) for i in kettys["price_list"]["items"]}
        self.assertEqual(changes, {"Carrots": ("up", "20.00"), "Beets": ("same", "18.50"), "Green cabbage": ("new", None)})
        self.assertEqual(kettys["price_list"]["gone"][0]["product"], "Turnips")

    def test_a_problem_saves_nothing(self):
        response = self.team.post("/api/admin/price-lists/", {"supplier": self.kettys.id, "cycle": self.cycle.id, "text": "Carrots\t50 lb\tlots"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("isn't a price", response.data["text"][0])

    def test_suppliers_send_their_own_list(self):
        farmer = client_for(User.objects.create_user("farm.test", role=User.Role.FARM, farm=self.footes))
        response = farmer.post("/api/supplier/price-lists/", {"cycle": self.cycle.id, "text": "Apples\t40 lb\t30"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(any("sent their price list" in m.subject for m in mail.outbox))


class OrderFormTests(OrderingTestCase):
    def test_dates_come_from_the_route(self):
        form = self.team.post("/api/admin/order-forms/", {"cycle": self.cycle.id, "routes": [self.halifax.id]}, format="json").data
        self.assertEqual(form["delivery_date"], self.cycle.drop_date - timedelta(days=1))  # trucks Friday, market Saturday

    def test_publishing_sets_market_days_and_tells_managers(self):
        mail.outbox.clear()
        form = self.open_form()
        drop = SiteDrop.objects.get(site=self.north_end, cycle=self.cycle)
        self.assertEqual(drop.drop_date, form["delivery_date"] + timedelta(days=1))
        self.assertTrue(any("order form is open" in m.subject for m in mail.outbox))

    def test_managers_order_boxes_and_see_totals_and_last_time(self):
        form = self.open_form()
        response = self.order(self.manager, form, {"Carrots": 3, "Apples": 2})
        self.assertEqual(response.data["my_order"], {"boxes": 5, "cost": "126.00", "updated_at": response.data["my_order"]["updated_at"]})
        self.assertEqual(self.order(self.manager, form, {"Carrots": 999}).status_code, 400)

    def test_ordering_closes_at_the_deadline(self):
        form = self.open_form()
        OrderForm.objects.filter(pk=form["id"]).update(orders_due=timezone.now() - timedelta(minutes=1))
        self.assertIn("closed", self.order(self.manager, form, {"Carrots": 1}).data["detail"])

    def test_a_new_form_can_start_from_the_last_one_at_this_cycles_prices(self):
        form = self.open_form()
        self.team.patch(f"/api/admin/order-form-items/{form['items'][0]['id']}/", {"deal": "good"}, format="json")
        later = DropCycle.objects.create(name="Later", drop_date=self.cycle.drop_date + timedelta(days=14), order_cutoff=timezone.now())
        self.team.post("/api/admin/price-lists/", {"supplier": self.kettys.id, "cycle": later.id, "text": "Carrots\t50 lb\t25\nBeets\t25 lb\t18"}, format="json")
        new = self.team.post("/api/admin/order-forms/", {"cycle": later.id, "routes": [self.halifax.id], "copy_last": True}, format="json").data
        items = {i["product"]: (i["price"], i["deal"]) for i in new["items"]}
        self.assertEqual(items, {"Carrots": ("25.00", "pricey"), "Beets": ("18.00", "")})  # price went up, so not a good deal


class SendingTests(OrderingTestCase):
    def test_wholesaler_sees_drop_off_points_and_farm_sees_locations(self):
        form = self.open_form()
        self.order(self.manager, form, {"Carrots": 3, "Apples": 2})
        self.order(client_for(self.fairview_cm), form, {"Carrots": 4})
        self.order(client_for(User.objects.create_user("cm.t", role=User.Role.COMMUNITY_MANAGER, site=self.tantallon)), form, {"Carrots": 1})
        mail.outbox.clear()
        detail = self.team.post(f"/api/admin/order-forms/{form['id']}/send/", format="json").data
        self.assertEqual(detail["status"], "sent")

        kettys = next(o for o in detail["supplier_orders"] if o["kind"] == "wholesaler")
        self.assertEqual([(g["name"], g["boxes"]) for g in kettys["groups"]], [("Fairview hub", 7), ("Upper Tantallon", 1)])
        footes = next(o for o in detail["supplier_orders"] if o["kind"] == "farm")
        self.assertEqual([g["name"] for g in footes["groups"]], ["North End"])
        self.assertEqual(detail["transport_runs"][0]["stops"][0]["sites"], ["Fairview", "North End"])
        # 10% of Ketty's for the North End (not Fairview's own order): 3 boxes × $22 = $66 → $6.60
        self.assertEqual(detail["hubs"][0]["share"], "6.60")
        self.assertEqual(len([m for m in mail.outbox if "order for delivery" in m.subject]), 2)

    def test_confirming_from_the_link(self):
        form = self.open_form()
        self.order(self.manager, form, {"Carrots": 3})
        self.team.post(f"/api/admin/order-forms/{form['id']}/send/", format="json")
        token = Confirmation.objects.get(supplier=self.kettys).token
        public = APIClient()
        seen = public.get(f"/api/confirm/{token}/").data
        self.assertEqual(seen["order"]["groups"][0]["items"][0]["product"], "Carrots")
        self.assertEqual(public.post(f"/api/confirm/{token}/", {"status": "cant"}, format="json").status_code, 400)  # needs a reason
        self.assertEqual(public.post(f"/api/confirm/{token}/", {"status": "confirmed"}, format="json").data["status"], "confirmed")
        self.assertEqual(public.get("/api/confirm/nope/").status_code, 404)

    def test_csv_export(self):
        form = self.open_form()
        self.order(self.manager, form, {"Carrots": 3})
        csv = self.team.get(f"/api/admin/order-forms/{form['id']}/orders.csv").content.decode()
        self.assertIn("North End,Halifax,Fairview hub,Ketty Brow's Wholesale Limited,Carrots,50 lb,22.00,3,66.00", csv)


class HubTests(OrderingTestCase):
    def test_hub_sees_what_arrives_for_each_location(self):
        form = self.open_form()
        self.order(self.manager, form, {"Carrots": 3})
        hub = client_for(self.fairview_cm).get("/api/manager/hub/").data["hubs"][0]
        self.assertEqual(hub["forms"][0]["locations"][0]["name"], "North End")
        self.assertEqual(hub["forms"][0]["share"], "6.60")
        self.assertEqual(self.manager.get("/api/manager/hub/").data["hubs"], [])


class CustomerSideTests(OrderingTestCase):
    def test_a_customers_bundle_comes_from_their_locations_order_once_sent(self):
        form = self.open_form()
        self.order(self.manager, form, {"Carrots": 3, "Apples": 2})
        self.north_end.online_reservations = True
        self.north_end.save()
        drop = SiteDrop.objects.get(site=self.north_end, cycle=self.cycle)
        from drops.reservations import bundle_for

        self.assertEqual(bundle_for(drop), [])  # not sent to suppliers yet
        self.team.post(f"/api/admin/order-forms/{form['id']}/send/", format="json")
        products = sorted(i["produce"] for i in bundle_for(drop))
        self.assertEqual(products, ["Apples", "Carrots"])
        public = APIClient().get("/api/bundle/").data
        self.assertEqual(sorted(i["produce"] for i in public["items"]), ["Apples", "Carrots"])

    def test_customers_can_reserve_until_orders_are_due(self):
        form = self.open_form()
        drop = SiteDrop.objects.get(site=self.north_end, cycle=self.cycle)
        self.assertEqual(drop.order_cutoff, OrderForm.objects.get(pk=form["id"]).orders_due)
