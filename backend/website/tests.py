from datetime import timedelta

from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from drops.models import Site
from .models import ContactMessage, Event


class PublicApiTests(TestCase):
    def test_anyone_can_see_active_locations_in_order(self):
        Site.objects.create(name="Windsor", address="613 King St", sort_order=2)
        Site.objects.create(name="Fairview / Clayton Park", address="50 Gesner St", sort_order=1)
        Site.objects.create(name="Closed", address="1 Old Rd", is_active=False)
        names = [site["name"] for site in APIClient().get("/api/sites/").data]
        self.assertEqual(names, ["Fairview / Clayton Park", "Windsor"])

    def test_contact_form_saves_the_message_and_emails_the_team(self):
        form = {"first_name": "Alex", "last_name": "Doe", "email": "alex@example.com", "message": "Hi!"}
        response = APIClient().post("/api/contact/", form, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ContactMessage.objects.get().message, "Hi!")
        self.assertEqual(len(mail.outbox), 1)

    def test_contact_form_needs_an_email_and_message(self):
        response = APIClient().post("/api/contact/", {"first_name": "Alex"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)
        self.assertIn("message", response.data)


class EventTests(TestCase):
    def setUp(self):
        today = timezone.localdate()
        self.admin = APIClient()
        self.admin.force_authenticate(User.objects.create_user("admin.test", role=User.Role.ADMIN))
        Event.objects.create(title="Past giveaway", starts_on=today - timedelta(days=30), description="Done")
        Event.objects.create(title="Harvest market", starts_on=today + timedelta(days=10), description="Soon")
        Event.objects.create(title="Hidden", starts_on=today + timedelta(days=5), description="Draft", is_published=False)

    def test_public_sees_published_upcoming_and_past(self):
        data = APIClient().get("/api/events/").data
        self.assertEqual([e["title"] for e in data["upcoming"]], ["Harvest market"])
        self.assertEqual([e["title"] for e in data["past"]], ["Past giveaway"])

    def test_admin_adds_and_checks_dates(self):
        ok = self.admin.post("/api/admin/events/", {"title": "Pop-up", "starts_on": "2030-05-01", "description": "Free produce"}, format="json")
        self.assertEqual(ok.status_code, 201)
        bad = self.admin.post(
            "/api/admin/events/",
            {"title": "Oops", "starts_on": "2030-05-02", "ends_on": "2030-05-01", "description": "x"},
            format="json",
        )
        self.assertIn("ends_on", bad.data)
        self.assertEqual(APIClient().post("/api/admin/events/", {}, format="json").status_code, 401)


class AreaRequestTests(TestCase):
    def test_request_a_location_and_the_team_sees_it_grouped_by_area(self):
        from rest_framework.test import APIClient

        from accounts.models import User

        public = APIClient()
        response = public.post("/api/area-requests/", {"email": "a@example.com", "postal_code": "b4n2l1", "town": "Kentville"}, format="json")
        self.assertEqual((response.status_code, response.data["area"]), (201, "B4N"))
        public.post("/api/area-requests/", {"email": "b@example.com", "postal_code": "B4N", "could_help": True}, format="json")
        public.post("/api/area-requests/", {"email": "c@example.com", "postal_code": "B0P 1X0"}, format="json")
        self.assertEqual(public.post("/api/area-requests/", {"email": "d@example.com", "postal_code": "12345"}, format="json").status_code, 400)

        admin = APIClient()
        admin.force_authenticate(User.objects.create_user("admin.test", role=User.Role.ADMIN))
        areas = admin.get("/api/admin/area-requests/").data["areas"]
        self.assertEqual(
            (areas[0]["area"], areas[0]["requests"], areas[0]["could_help"], areas[0]["towns"]), ("B4N", 2, 1, ["Kentville"])
        )
        self.assertIn("would like to help", mail.outbox[-1].subject)
