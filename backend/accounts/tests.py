from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory

from .management.commands.seed import DEMO_PASSWORD, DEMO_USERS
from .models import User
from .permissions import IsAdminRole, IsCommunityManager

LOGIN = "/api/auth/login/"
LOGOUT = "/api/auth/logout/"
ME = "/api/auth/me/"
CHECK_LOGIN = "/api/auth/check-login/"
GENERIC_ERROR = "That username and password don't match."


class LoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("cm.test", password="pw", role=User.Role.COMMUNITY_MANAGER)

    def login(self, username, password):
        return self.client.post(LOGIN, {"username": username, "password": password}, format="json")

    def test_correct_login_returns_user_with_role(self):
        response = self.login("cm.test", "pw")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "community_manager")

    def test_wrong_password_is_rejected(self):
        response = self.login("cm.test", "nope")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], GENERIC_ERROR)

    def test_unknown_username_gets_the_same_message_as_wrong_password(self):
        # So nobody can use the login page to find out which usernames exist.
        response = self.login("nobody", "pw")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], GENERIC_ERROR)

    def test_blank_username_or_password_is_rejected(self):
        self.assertEqual(self.login("", "pw").status_code, 400)
        self.assertEqual(self.login("cm.test", "").status_code, 400)

    def test_password_is_case_sensitive(self):
        self.assertEqual(self.login("cm.test", "PW").status_code, 400)

    def test_spaces_around_username_are_ignored(self):
        self.assertEqual(self.login("  cm.test ", "pw").status_code, 200)

    def test_switched_off_account_cannot_log_in(self):
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.login("cm.test", "pw").status_code, 400)

    def test_me_requires_login_and_logout_ends_the_session(self):
        self.assertEqual(self.client.get(ME).status_code, 403)
        self.login("cm.test", "pw")
        self.assertEqual(self.client.get(ME).data["username"], "cm.test")
        self.client.post(LOGOUT)
        self.assertEqual(self.client.get(ME).status_code, 403)

    def test_login_without_csrf_token_is_blocked(self):
        strict_client = APIClient(enforce_csrf_checks=True)
        response = strict_client.post(LOGIN, {"username": "cm.test", "password": "pw"}, format="json")
        self.assertEqual(response.status_code, 403)


class DemoAccountTests(TestCase):
    def test_every_seeded_demo_account_can_log_in_with_the_right_role(self):
        call_command("seed", stdout=StringIO())
        for username, _first, _last, role, _site in DEMO_USERS:
            client = APIClient()
            response = client.post(LOGIN, {"username": username, "password": DEMO_PASSWORD}, format="json")
            self.assertEqual(response.status_code, 200, username)
            self.assertEqual(response.data["role"], role, username)


class CheckLoginTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin.test", password="pw", role=User.Role.ADMIN)
        self.farm = User.objects.create_user("farm.test", password="farmpw", role=User.Role.FARM)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def check(self, username, password):
        return self.client.post(CHECK_LOGIN, {"username": username, "password": password}, format="json").data

    def test_only_admins_can_use_it(self):
        other = APIClient()
        other.force_authenticate(self.farm)
        self.assertEqual(other.post(CHECK_LOGIN, {}, format="json").status_code, 403)

    def test_correct_details_are_valid_and_show_the_role(self):
        result = self.check("farm.test", "farmpw")
        self.assertTrue(result["valid"])
        self.assertEqual(result["user"]["role"], "farm")

    def test_says_why_a_login_would_fail(self):
        self.assertEqual(self.check("farm.test", "wrong")["reason"], "The password is wrong.")
        self.assertEqual(self.check("nobody", "pw")["reason"], "No account has that username.")
        self.assertEqual(self.check("", "")["reason"], "Username and password are both required.")
        self.farm.is_active = False
        self.farm.save()
        self.assertEqual(self.check("farm.test", "farmpw")["reason"], "This account has been switched off.")

    def test_does_not_change_who_is_logged_in(self):
        client = APIClient()
        client.post(LOGIN, {"username": "admin.test", "password": "pw"}, format="json")
        client.post(CHECK_LOGIN, {"username": "farm.test", "password": "farmpw"}, format="json")
        self.assertEqual(client.get(ME).data["username"], "admin.test")


class RolePermissionTests(TestCase):
    def test_role_permissions_match_only_their_role(self):
        request = APIRequestFactory().get("/")
        request.user = User.objects.create_user("farm.test", role=User.Role.FARM)
        self.assertFalse(IsAdminRole().has_permission(request, None))
        self.assertFalse(IsCommunityManager().has_permission(request, None))
        request.user.role = User.Role.ADMIN
        self.assertTrue(IsAdminRole().has_permission(request, None))
