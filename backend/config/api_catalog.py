"""Lists every API endpoint in the project, for the admin "API" page.

Nothing here needs updating by hand: it reads Django's URL list, so a new
endpoint shows up automatically. Its description is the view's docstring,
so write a clear one-line docstring on every API view.
"""

import inspect

from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole

# Friendly names for permission classes, shown as "Who can use it".
PERMISSION_LABELS = {
    "AllowAny": "Anyone",
    "IsAuthenticated": "Anyone logged in",
    "IsAdminRole": "Admin",
    "IsCommunityManager": "Community Manager",
    "IsFarm": "Farm",
    "IsHostSite": "Host Site",
}

HTTP_METHODS = ["get", "post", "put", "patch", "delete"]


def _all_urls(patterns, prefix=""):
    """Yield (path, view) for every URL, including ones inside include()."""
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            yield from _all_urls(pattern.url_patterns, prefix + str(pattern.pattern))
        elif isinstance(pattern, URLPattern):
            yield prefix + str(pattern.pattern), pattern.callback


def _permission_label(permission):
    # Permissions combined with | or &, e.g. [IsAdminRole | IsFarm]
    if hasattr(permission, "op1_class"):
        joiner = " or " if permission.operator_class.__name__ == "OR" else " and "
        return _permission_label(permission.op1_class) + joiner + _permission_label(permission.op2_class)
    return PERMISSION_LABELS.get(permission.__name__, permission.__name__)


class ApiCatalogView(APIView):
    """Lists every API endpoint, who can use it and what it does."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        endpoints = []
        for path, view in _all_urls(get_resolver().url_patterns):
            view_class = getattr(view, "view_class", None)
            if not path.startswith("api/") or view_class is None:
                continue
            endpoints.append(
                {
                    "path": "/" + path,
                    "group": path.split("/")[1],
                    "methods": [m.upper() for m in HTTP_METHODS if hasattr(view_class, m)],
                    "who": [_permission_label(p) for p in view_class.permission_classes],
                    "description": inspect.getdoc(view_class) or "",
                    "has_parameters": "<" in path,
                }
            )
        return Response(endpoints)
