"""Prints emails in the runserver terminal as plain, readable text instead of sending them.

Django's own console backend prints the raw email, which wraps long lines and encodes "=" signs,
so links (like password reset links) can't be copied from the terminal. This one prints each
email as it would read in an inbox. To send real email, change MAILERS in settings.py.
"""

import sys

from django.core.mail.backends.base import BaseEmailBackend


class ReadableConsoleBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        for message in email_messages:
            sys.stdout.write(
                "\n" + "=" * 72 + "\n"
                "EMAIL (not really sent; this prototype prints emails here)\n"
                f"To:      {', '.join(message.to)}\n"
                f"Subject: {message.subject}\n"
                + "-" * 72 + "\n"
                f"{message.body}\n"
                + "=" * 72 + "\n"
            )
        sys.stdout.flush()
        return len(email_messages)
