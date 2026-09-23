from django.contrib import admin
from django.urls import include, path

from accounts import views as account_views
from website.views import ContactView
from .api_catalog import ApiCatalogView

urlpatterns = [
    # Django's built-in admin, handy for inspecting data. Not the portal's Admin role screens.
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/signup/", account_views.SignupView.as_view()),
    path("api/applications/", account_views.ApplicationListView.as_view()),
    path("api/applications/<int:pk>/approve/", account_views.ApproveApplicationView.as_view()),
    path("api/applications/<int:pk>/decline/", account_views.DeclineApplicationView.as_view()),
    path("api/sites/", include("drops.urls")),
    path("api/contact/", ContactView.as_view()),
    path("api/catalog/", ApiCatalogView.as_view()),
]
