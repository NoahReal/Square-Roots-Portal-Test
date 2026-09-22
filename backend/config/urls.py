from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    # Django's built-in admin, handy for inspecting data. Not the portal's Admin role screens.
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
]
