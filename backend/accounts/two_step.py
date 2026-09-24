"""Two-step login: a 6-digit code from an authenticator app (Google Authenticator, Microsoft
Authenticator, 1Password and others), on top of the password.

This is the standard "TOTP" method (RFC 6238), written out here so there's no extra package:
the app and the server share a secret, and both turn the current 30-second time window into
the same 6-digit code.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

STEP_SECONDS = 30
DIGITS = 6


def new_secret():
    """A random secret, written in the letters and numbers authenticator apps expect."""
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def code_at(secret, window):
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", window), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(number % 10**DIGITS).zfill(DIGITS)


def check_code(secret, code, now=None):
    """Whether `code` is right. The code just before and after also count, in case a phone's clock is a little off."""
    code = "".join(ch for ch in str(code or "") if ch.isdigit())
    if not secret or len(code) != DIGITS:
        return False
    window = int((now or time.time()) // STEP_SECONDS)
    return any(hmac.compare_digest(code_at(secret, window + drift), code) for drift in (-1, 0, 1))


def app_link(secret, username):
    """An otpauth:// link: tapping it on a phone adds the account to the authenticator app."""
    label = quote(f"Square Roots:{username}")
    return f"otpauth://totp/{label}?secret={secret}&issuer=Square%20Roots&digits={DIGITS}&period={STEP_SECONDS}"
