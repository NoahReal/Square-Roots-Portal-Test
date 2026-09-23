from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User

CATALOG = "/api/catalog/"


class ApiCatalogTests(TestCase):
    def client_for(self, role):
        client = APIClient()
        client.force_authenticate(User.objects.create_user(f"{role}.test", role=role))
        return client

    def test_only_admins_can_see_it(self):
        self.assertEqual(APIClient().get(CATALOG).status_code, 401)  # not logged in
        self.assertEqual(self.client_for(User.Role.COMMUNITY_MANAGER).get(CATALOG).status_code, 403)
        self.assertEqual(self.client_for(User.Role.ADMIN).get(CATALOG).status_code, 200)

    def test_lists_endpoints_with_methods_and_who_can_use_them(self):
        endpoints = {e["path"]: e for e in self.client_for(User.Role.ADMIN).get(CATALOG).data}
        self.assertEqual(endpoints["/api/auth/login/"]["methods"], ["POST"])
        self.assertEqual(endpoints["/api/auth/login/"]["who"], ["Anyone"])
        self.assertEqual(endpoints["/api/auth/me/"]["who"], ["Anyone logged in"])
        self.assertEqual(endpoints["/api/catalog/"]["who"], ["Admin"])
        self.assertTrue(endpoints["/api/auth/login/"]["description"])
