"""How API errors are sent back.

DRF normally answers "not logged in" with 403, the same as "not allowed". We send 401
instead, so the React app can tell a login that has expired apart from a real "no",
and take the person back to the login page.
"""

import math

from rest_framework.exceptions import NotAuthenticated, Throttled
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None and isinstance(exc, NotAuthenticated):
        response.status_code = 401
        response.data = {"detail": "Please log in again.", "code": "not_logged_in"}
    if response is not None and isinstance(exc, Throttled):
        minutes = max(1, math.ceil((exc.wait or 60) / 60))
        response.data = {"detail": f"Too many tries from this device. Please wait {minutes} minute{'s' if minutes > 1 else ''} and try again."}
    return response
