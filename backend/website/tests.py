from django.core import mail
from django.test import TestCase
from rest_framework.test import APIClient

from drops.models import Site
from .models import ContactMessage


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
