from django.urls import path

from . import views, views_admin

urlpatterns = [
    # Farms
    path("farm/produce/", views.ProduceListView.as_view()),
    path("farm/produce/<int:pk>/", views.ProduceDetailView.as_view()),
    path("farm/orders/", views.FarmOrderListView.as_view()),
    path("farm/orders/<int:pk>/confirm/", views.ConfirmOrderView.as_view()),
    path("farm/orders/<int:pk>/cant-fill/", views.CantFillOrderView.as_view()),
    # Admins
    path("admin/produce/", views_admin.AllProduceView.as_view()),
    path("admin/cycles/<int:pk>/buy/", views_admin.BuyProduceView.as_view()),
    path("admin/farm-order-lines/<int:pk>/", views_admin.RemoveOrderLineView.as_view()),
    path("admin/farm-orders/<int:pk>/", views_admin.FarmOrderDetailView.as_view()),
    path("admin/farm-orders/<int:pk>/paid/", views_admin.MarkPaidView.as_view()),
]
