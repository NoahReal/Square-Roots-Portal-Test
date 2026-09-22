from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory

from .models import User
from .permissions import IsAdminRole, IsCommunityManager


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("cm.test", password="pw", role=User.Role.COMMUNITY_MANAGER)

    def test_login_returns_user_with_role(self):
        response = self.client.post("/api/auth/login/", {"username": "cm.test", "password": "pw"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "community_manager")

    def test_wrong_password_is_rejected(self):
        response = self.client.post("/api/auth/login/", {"username": "cm.test", "password": "nope"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_me_requires_login(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 403)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/auth/me/").data["username"], "cm.test")


class RolePermissionTests(TestCase):
    def test_role_permissions_match_only_their_role(self):
        request = APIRequestFactory().get("/")
        request.user = User.objects.create_user("farm.test", role=User.Role.FARM)
        self.assertFalse(IsAdminRole().has_permission(request, None))
        self.assertFalse(IsCommunityManager().has_permission(request, None))
        request.user.role = User.Role.ADMIN
        self.assertTrue(IsAdminRole().has_permission(request, None))
