"""Emails the portal would send.

This prototype doesn't send real email: each email is printed, as readable text,
in the terminal running `manage.py runserver` (see accounts/email_backend.py and
MAILERS in settings.py). To send real email later, change that setting.
"""

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone


def notify_team(subject, body):
    send_mail(f"[Square Roots] {subject}", body, settings.DEFAULT_FROM_EMAIL, [settings.TEAM_EMAIL])


def notify_person(user, subject, body):
    if user.email:
        send_mail(f"[Square Roots] {subject}", body, settings.DEFAULT_FROM_EMAIL, [user.email])


def friendly_time(moment):
    """A date and time the way people write it: "Friday, October 9 at 9:00 a.m." (in Halifax time)."""
    local = timezone.localtime(moment)
    hour = local.hour % 12 or 12
    suffix = "a.m." if local.hour < 12 else "p.m."
    return f"{local:%A, %B} {local.day} at {hour}:{local.minute:02d} {suffix}"
