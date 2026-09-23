"""Emails the portal would send.

This prototype doesn't send real email: each email is printed, as readable text,
in the terminal running `manage.py runserver` (see accounts/email_backend.py and
MAILERS in settings.py). To send real email later, change that setting.
"""

from django.conf import settings
from django.core.mail import send_mail


def notify_team(subject, body):
    send_mail(f"[Square Roots] {subject}", body, settings.DEFAULT_FROM_EMAIL, [settings.TEAM_EMAIL])


def notify_person(user, subject, body):
    if user.email:
        send_mail(f"[Square Roots] {subject}", body, settings.DEFAULT_FROM_EMAIL, [user.email])
