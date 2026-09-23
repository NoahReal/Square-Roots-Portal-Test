from django.urls import path

from . import views, views_admin, views_manager, views_operations, views_reserve

urlpatterns = [
    # Public
    path("sites/", views.SiteListView.as_view()),
    path("drop-dates/", views.DropDatesView.as_view()),
    path("pricing/", views.PricingView.as_view()),
    # Customers reserving bundles (public, no account)
    path("reserve/options/", views_reserve.ReserveOptionsView.as_view()),
    path("reserve/", views_reserve.ReserveView.as_view()),
    path("reserve/<str:token>/", views_reserve.ManageReservationView.as_view()),
    # Host sites
    path("host/drops/", views.HostDropListView.as_view()),
    # Community Managers
    path("manager/drops/", views_manager.ManagerDropListView.as_view()),
    path("manager/drops/<int:pk>/order/", views_manager.OrderView.as_view()),
    path("manager/drops/<int:pk>/preorders/", views_manager.PreorderListView.as_view()),
    path("manager/drops/<int:pk>/report/", views_manager.DropReportView.as_view()),
    path("manager/drops/<int:pk>/pickup/<str:code>/", views_manager.PickupCodeView.as_view()),
    path("manager/preorders/<int:pk>/", views_manager.PreorderDetailView.as_view()),
    path("manager/reservations/", views_manager.ReservationSettingsView.as_view()),
    # Admins
    path("admin/cycles/", views_admin.CycleListView.as_view()),
    path("admin/cycles/<int:pk>/", views_admin.CycleDetailView.as_view()),
    path("admin/cycles/<int:pk>/sites/", views_admin.CycleSiteView.as_view()),
    path("admin/site-drops/<int:pk>/", views_admin.SiteDropDetailView.as_view()),
    path("admin/site-drops/<int:pk>/order/", views_admin.SiteOrderView.as_view()),
    path("admin/locations/", views_admin.LocationListView.as_view()),
    path("admin/locations/<int:pk>/", views_admin.LocationDetailView.as_view()),
    path("admin/dashboard/", views_admin.DashboardView.as_view()),
    path("admin/impact/", views_admin.ImpactView.as_view()),
    path("admin/impact.csv", views_admin.ImpactCsvView.as_view()),
    path("admin/settings/", views_operations.SettingsView.as_view()),
    path("admin/money/", views_operations.MoneyView.as_view()),
    path("admin/money.csv", views_operations.MoneyCsvView.as_view()),
    path("admin/money/<int:pk>/received/", views_operations.RemittanceView.as_view()),
    path("admin/cycles/<int:pk>/logistics/", views_operations.LogisticsView.as_view()),
    path("admin/cycles/<int:pk>/deliveries.csv", views_operations.DeliveriesCsvView.as_view()),
]
