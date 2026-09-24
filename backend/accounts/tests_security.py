import time

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import two_step
from .models import User

REAL_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


class TwoStepCodeTests(TestCase):
    def test_codes_match_the_standard(self):
        # The test secret and codes published with the TOTP standard (RFC 6238), in base32.
        secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
        self.assertEqual(two_step.code_at(secret, 59 // 30), "287082")
        self.assertEqual(two_step.code_at(secret, 1111111109 // 30), "081804")

    def test_a_code_a_little_early_or_late_still_works(self):
        secret = two_step.new_secret()
        now = time.time()
        previous = two_step.code_at(secret, int(now // 30) - 1)
        self.assertTrue(two_step.check_code(secret, previous, now))
        self.assertFalse(two_step.check_code(secret, "12345", now))


class TwoStepLoginTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("admin.test", password="a-long-password", role=User.Role.ADMIN)
        self.client = APIClient()

    def login(self, **extra):
        return self.client.post("/api/auth/login/", {"username": "admin.test", "password": "a-long-password", **extra}, format="json")

    def test_turn_on_then_login_needs_the_code(self):
        self.client.force_authenticate(self.user)
        started = self.client.post("/api/auth/two-step/", {}, format="json").data
        self.assertTrue(started["app_link"].startswith("otpauth://totp/"))
        self.assertEqual(self.client.post("/api/auth/two-step/", {"code": "000000"}, format="json").status_code, 400)
        code = two_step.code_at(started["secret"], int(time.time() // 30))
        self.assertTrue(self.client.post("/api/auth/two-step/", {"code": code}, format="json").data["two_step"])
        self.client.force_authenticate(None)

        response = self.login()
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.data["needs_code"])
        self.user.refresh_from_db()
        response = self.login(code=two_step.code_at(self.user.two_step_secret, int(time.time() // 30)))
        self.assertEqual(response.status_code, 200)

    def test_turning_off_needs_the_password(self):
        self.user.two_step_secret = two_step.new_secret()
        self.user.save()
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.delete("/api/auth/two-step/", {"password": "wrong"}, format="json").status_code, 400)
        self.assertFalse(self.client.delete("/api/auth/two-step/", {"password": "a-long-password"}, format="json").data["two_step"])


@override_settings(CACHES=REAL_CACHE)
class LimitTests(TestCase):
    def setUp(self):
        cache.clear()
        User.objects.create_user("cm.test", password="a-long-password")
        self.client = APIClient()

    def test_ten_wrong_passwords_lock_the_username_for_a_while(self):
        for _ in range(10):
            self.client.post("/api/auth/login/", {"username": "cm.test", "password": "guess"}, format="json")
        response = self.client.post("/api/auth/login/", {"username": "cm.test", "password": "a-long-password"}, format="json")
        self.assertEqual(response.status_code, 429)
        self.assertIn("Too many wrong passwords", response.data["detail"])

    def test_the_contact_form_is_limited_per_visitor(self):
        message = {"first_name": "A", "email": "a@example.com", "message": "Hi"}
        codes = [self.client.post("/api/contact/", message, format="json").status_code for _ in range(11)]
        self.assertEqual(codes[:10], [201] * 10)
        self.assertEqual(codes[10], 429)
