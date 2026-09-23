from django.urls import path

from . import views, views_admin, views_manager

urlpatterns = [
    # Public
    path("sites/", views.SiteListView.as_view()),
    path("drop-dates/", views.DropDatesView.as_view()),
    # Host sites
    path("host/drops/", views.HostDropListView.as_view()),
    # Community Managers
    path("manager/drops/", views_manager.ManagerDropListView.as_view()),
    path("manager/drops/<int:pk>/order/", views_manager.OrderView.as_view()),
    path("manager/drops/<int:pk>/preorders/", views_manager.PreorderListView.as_view()),
    path("manager/drops/<int:pk>/report/", views_manager.DropReportView.as_view()),
    path("manager/preorders/<int:pk>/", views_manager.PreorderDetailView.as_view()),
    # Admins
    path("admin/cycles/", views_admin.CycleListView.as_view()),
    path("admin/cycles/<int:pk>/", views_admin.CycleDetailView.as_view()),
    path("admin/cycles/<int:pk>/sites/", views_admin.CycleSiteView.as_view()),
    path("admin/site-drops/<int:pk>/", views_admin.SiteDropDetailView.as_view()),
    path("admin/impact/", views_admin.ImpactView.as_view()),
    path("admin/impact.csv", views_admin.ImpactCsvView.as_view()),
]
