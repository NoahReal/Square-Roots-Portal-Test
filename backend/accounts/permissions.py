"""Role checks for API views.

Use these in a view's `permission_classes`, for example:

    permission_classes = [IsAdminRole]
    permission_classes = [IsAdminRole | IsCommunityManager]
"""

from rest_framework.permissions import BasePermission

from .models import User


class _HasRole(BasePermission):
    role = None

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == self.role)


class IsAdminRole(_HasRole):
    role = User.Role.ADMIN


class IsCommunityManager(_HasRole):
    role = User.Role.COMMUNITY_MANAGER


class IsFarm(_HasRole):
    role = User.Role.FARM


class IsHostSite(_HasRole):
    role = User.Role.HOST_SITE
