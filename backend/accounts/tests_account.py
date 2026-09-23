import re

from django.core import mail
from django.test import TestCase
from rest_framework.test import APIClient

from drops.models import Site
from .models import Application, User

ME = "/api/auth/me/"


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


class MyAccountTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("cm.test", password="old-pass-123", email="old@example.com", first_name="Jo")
        self.client = client_for(self.user)

    def test_change_my_details(self):
        response = self.client.patch(ME, {"phone": "902-555-0000", "email": "new@example.com"}, format="json")
        self.assertEqual(response.data["phone"], "902-555-0000")
        self.assertEqual(response.data["email"], "new@example.com")

    def test_name_and_email_cannot_be_blank(self):
        response = self.client.patch(ME, {"first_name": "", "email": ""}, format="json")
        self.assertEqual(set(response.data), {"first_name", "email"})

    def test_change_password_needs_the_current_one(self):
        wrong = self.client.post("/api/auth/change-password/", {"current_password": "nope", "new_password": "fresh-carrots-26"}, format="json")
        self.assertIn("current_password", wrong.data)
        weak = self.client.post("/api/auth/change-password/", {"current_password": "old-pass-123", "new_password": "123"}, format="json")
        self.assertIn("new_password", weak.data)
        ok = self.client.post("/api/auth/change-password/", {"current_password": "old-pass-123", "new_password": "fresh-carrots-26"}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("fresh-carrots-26"))


class PasswordResetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("farm.test", password="forgotten-1", email="ruth@example.com", first_name="Ruth")

    def test_reset_by_email_link(self):
        client = APIClient()
        response = client.post("/api/auth/password-reset/", {"email": "RUTH@example.com"}, format="json")
        self.assertEqual(response.status_code, 200)
        link = re.search(r"reset-password\?uid=(\S+)&token=(\S+)", mail.outbox[0].body)
        self.assertIn("farm.test", mail.outbox[0].body)  # reminds them of their username too

        uid, token = link.groups()
        done = client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "new_password": "new-beets-2026"}, format="json")
        self.assertEqual(done.data["username"], "farm.test")
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("new-beets-2026"))

        # The link only works once.
        again = client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "new_password": "another-pass-9"}, format="json")
        self.assertEqual(again.status_code, 400)

    def test_unknown_email_gets_the_same_answer_and_no_email(self):
        response = APIClient().post("/api/auth/password-reset/", {"email": "nobody@example.com"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)


class ApprovalLocationTests(TestCase):
    def setUp(self):
        self.admin = client_for(User.objects.create_user("admin.test", role=User.Role.ADMIN))
        self.windsor = Site.objects.create(name="Windsor", address="613 King St")
        self.applicant = User.objects.create_user(
            "apply.cm", role=User.Role.COMMUNITY_MANAGER, status=User.Status.PENDING, email="a@example.com"
        )
        self.application = Application.objects.create(user=self.applicant, planned_location="Bedford")
        self.approve_url = f"/api/applications/{self.application.id}/approve/"

    def test_community_manager_needs_a_location_to_be_approved(self):
        response = self.admin.post(self.approve_url, {}, format="json")
        self.assertIn("site", response.data)
        self.applicant.refresh_from_db()
        self.assertEqual(self.applicant.status, User.Status.PENDING)

    def test_approve_with_an_existing_location(self):
        self.admin.post(self.approve_url, {"site": self.windsor.id}, format="json")
        self.applicant.refresh_from_db()
        self.assertEqual((self.applicant.status, self.applicant.site), (User.Status.APPROVED, self.windsor))

    def test_approve_and_create_a_new_location(self):
        self.admin.post(self.approve_url, {"new_site": {"name": "Bedford", "address": "1 Library Rd"}}, format="json")
        self.applicant.refresh_from_db()
        self.assertEqual(self.applicant.site.name, "Bedford")
        self.assertIn("Bedford", mail.outbox[-1].body)

    def test_decline_with_a_reason(self):
        self.admin.post(f"/api/applications/{self.application.id}/decline/", {"reason": "We're full in Bedford for now."}, format="json")
        self.application.refresh_from_db()
        self.assertEqual(self.application.decline_reason, "We're full in Bedford for now.")
        self.assertIn("full in Bedford", mail.outbox[-1].body)


class PeopleAdminTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user("admin.test", role=User.Role.ADMIN)
        self.admin = client_for(self.admin_user)
        self.site = Site.objects.create(name="Windsor", address="613 King St")
        self.cm = User.objects.create_user("cm.test", role=User.Role.COMMUNITY_MANAGER, first_name="Jordan", email="j@example.com")

    def test_list_filter_and_search(self):
        data = self.admin.get("/api/admin/people/?role=community_manager").data
        self.assertEqual([p["username"] for p in data["people"]], ["cm.test"])
        self.assertEqual(len(self.admin.get("/api/admin/people/?q=jord").data["people"]), 1)
        self.assertEqual(data["sites"][0]["name"], "Windsor")

    def test_link_a_location_and_switch_off(self):
        response = self.admin.patch(f"/api/admin/people/{self.cm.id}/", {"site": self.site.id, "is_active": False}, format="json")
        self.assertEqual((response.data["site_name"], response.data["is_active"]), ("Windsor", False))

    def test_cannot_switch_off_yourself(self):
        response = self.admin.patch(f"/api/admin/people/{self.admin_user.id}/", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_send_a_password_reset(self):
        self.admin.post(f"/api/admin/people/{self.cm.id}/password-reset/")
        self.assertEqual(mail.outbox[-1].to, ["j@example.com"])

    def test_only_admins(self):
        self.assertEqual(client_for(self.cm).get("/api/admin/people/").status_code, 403)
