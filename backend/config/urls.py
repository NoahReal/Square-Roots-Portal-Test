from django.contrib import admin
from django.urls import include, path

from accounts import views as account_views
from accounts import views_admin as account_admin_views
from website import views as website_views
from .api_catalog import ApiCatalogView

urlpatterns = [
    # Django's built-in admin, handy for inspecting data. Not the portal's Admin role screens.
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/signup/", account_views.SignupView.as_view()),
    path("api/applications/", account_views.ApplicationListView.as_view()),
    path("api/applications/<int:pk>/approve/", account_views.ApproveApplicationView.as_view()),
    path("api/applications/<int:pk>/decline/", account_views.DeclineApplicationView.as_view()),
    path("api/admin/people/", account_admin_views.PeopleView.as_view()),
    path("api/admin/people/<int:pk>/", account_admin_views.PersonDetailView.as_view()),
    path("api/admin/people/<int:pk>/password-reset/", account_admin_views.SendPasswordResetView.as_view()),
    path("api/", include("drops.urls")),
    path("api/", include("farms.urls")),
    path("api/contact/", website_views.ContactView.as_view()),
    path("api/area-requests/", website_views.AreaRequestView.as_view()),
    path("api/site-text/", website_views.SiteTextView.as_view()),
    path("api/admin/site-text/", website_views.AdminSiteTextView.as_view()),
    path("api/admin/area-requests/", website_views.AdminAreaRequestView.as_view()),
    path("api/admin/area-requests/<int:pk>/", website_views.AdminAreaRequestDetailView.as_view()),
    path("api/events/", website_views.PublicEventsView.as_view()),
    path("api/admin/events/", website_views.AdminEventListView.as_view()),
    path("api/admin/events/<int:pk>/", website_views.AdminEventDetailView.as_view()),
    path("api/catalog/", ApiCatalogView.as_view()),
    path("sitemap.xml", website_views.sitemap),
    path("robots.txt", website_views.robots),
]
