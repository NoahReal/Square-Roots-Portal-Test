from types import SimpleNamespace

from django.core import mail
from django.test import TestCase
from rest_framework.test import APIClient

from drops.models import Site
from .models import Application, User
from .permissions import IsCommunityManager

SIGNUP = "/api/signup/"
ME = "/api/auth/me/"
APPLICATIONS = "/api/applications/"


def farm_form(**changes):
    form = {
        "role": "farm",
        "username": "newfarm",
        "password": "carrots-and-kale-2026",
        "first_name": "Sam",
        "last_name": "Porter",
        "email": "sam@example.com",
        "organization": "North Mountain Market Garden",
        "produce_types": "Carrots, beets",
        "pounds_available": "300 lbs",
    }
    form.update(changes)
    return form


class SignupTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.site = Site.objects.create(name="Windsor", address="613 King St")

    def test_signup_creates_a_pending_account_and_logs_them_in(self):
        response = self.client.post(SIGNUP, farm_form(), format="json")
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="newfarm")
        self.assertEqual(user.status, User.Status.PENDING)
        self.assertEqual(user.application.organization, "North Mountain Market Garden")
        self.assertEqual(self.client.get(ME).data["status"], "pending")

    def test_signup_emails_the_team(self):
        self.client.post(SIGNUP, farm_form(), format="json")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("New Farm sign-up", mail.outbox[0].subject)

    def test_nobody_can_sign_up_as_an_admin(self):
        response = self.client.post(SIGNUP, farm_form(role="admin"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.data)

    def test_username_must_be_unused(self):
        User.objects.create_user("NewFarm")
        response = self.client.post(SIGNUP, farm_form(), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("username", response.data)

    def test_weak_passwords_are_refused(self):
        response = self.client.post(SIGNUP, farm_form(password="12345"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)

    def test_all_field_problems_are_reported_together(self):
        User.objects.create_user("newfarm")
        response = self.client.post(SIGNUP, farm_form(password="12345"), format="json")
        self.assertIn("username", response.data)
        self.assertIn("password", response.data)

    def test_each_role_must_fill_in_its_own_questions(self):
        response = self.client.post(SIGNUP, farm_form(produce_types=""), format="json")
        self.assertEqual(response.data["produce_types"], ["Please fill this in."])

    def test_community_manager_must_choose_or_suggest_a_location(self):
        form = farm_form(role="community_manager", phone="902-555-0100")
        response = self.client.post(SIGNUP, form, format="json")
        self.assertIn("planned_location", response.data)
        response = self.client.post(SIGNUP, {**form, "site": self.site.id}, format="json")
        self.assertEqual(response.status_code, 201)

    def test_pending_accounts_cannot_use_role_screens_yet(self):
        self.client.post(SIGNUP, farm_form(role="community_manager", phone="1", site=self.site.id), format="json")
        user = User.objects.get(username="newfarm")
        request = SimpleNamespace(user=user)
        self.assertFalse(IsCommunityManager().has_permission(request, None))
        user.status = User.Status.APPROVED
        self.assertTrue(IsCommunityManager().has_permission(request, None))


class ApplicationReviewTests(TestCase):
    def setUp(self):
        self.site = Site.objects.create(name="Windsor", address="613 King St")
        self.admin = User.objects.create_user("admin.test", role=User.Role.ADMIN)
        self.applicant = User.objects.create_user(
            "apply.test", email="apply@example.com", role=User.Role.COMMUNITY_MANAGER, status=User.Status.PENDING
        )
        self.application = Application.objects.create(user=self.applicant, site=self.site)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_only_admins_can_see_or_review_sign_ups(self):
        other = APIClient()
        other.force_authenticate(User.objects.create_user("cm.test", role=User.Role.COMMUNITY_MANAGER))
        self.assertEqual(other.get(APPLICATIONS).status_code, 403)
        self.assertEqual(other.post(f"{APPLICATIONS}{self.application.id}/approve/").status_code, 403)

    def test_list_can_be_filtered_by_status(self):
        self.assertEqual(len(self.client.get(APPLICATIONS + "?status=pending").data), 1)
        self.assertEqual(len(self.client.get(APPLICATIONS + "?status=approved").data), 0)

    def test_approving_activates_the_account_links_the_location_and_emails_them(self):
        response = self.client.post(f"{APPLICATIONS}{self.application.id}/approve/")
        self.assertEqual(response.status_code, 200)
        self.applicant.refresh_from_db()
        self.assertEqual(self.applicant.status, User.Status.APPROVED)
        self.assertEqual(self.applicant.site, self.site)
        self.assertEqual(response.data["reviewed_by_name"], self.admin.get_full_name())
        self.assertEqual(mail.outbox[-1].to, ["apply@example.com"])

    def test_declining_marks_the_account_declined(self):
        self.client.post(f"{APPLICATIONS}{self.application.id}/decline/")
        self.applicant.refresh_from_db()
        self.assertEqual(self.applicant.status, User.Status.DECLINED)
