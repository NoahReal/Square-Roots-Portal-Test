from django.urls import path

from . import views

urlpatterns = [
    # Admins
    path("admin/ordering/", views.OrderingSetupView.as_view()),
    path("admin/ordering/routes/<int:pk>/", views.RouteSwitchView.as_view()),
    path("admin/transport-companies/", views.TransportCompanyView.as_view()),
    path("admin/price-lists/", views.PriceListView.as_view()),
    path("admin/price-items/<int:pk>/", views.PriceItemView.as_view()),
    path("admin/order-forms/", views.OrderFormListView.as_view()),
    path("admin/order-forms/<int:pk>/", views.OrderFormDetailView.as_view()),
    path("admin/order-forms/<int:pk>/items/", views.OrderFormItemsView.as_view()),
    path("admin/order-forms/<int:pk>/publish/", views.PublishFormView.as_view()),
    path("admin/order-forms/<int:pk>/send/", views.SendFormView.as_view()),
    path("admin/order-forms/<int:pk>/orders.csv", views.OrderFormCsvView.as_view()),
    path("admin/order-form-items/<int:pk>/", views.OrderFormItemView.as_view()),
    # Community Managers
    path("manager/order-forms/", views.ManagerOrderFormsView.as_view()),
    path("manager/order-forms/<int:pk>/order/", views.ManagerOrderView.as_view()),
    path("manager/hub/", views.HubView.as_view()),
    # Suppliers
    path("supplier/price-lists/", views.SupplierPriceListView.as_view()),
    # Suppliers and transport companies answering from a private link (no login)
    path("confirm/<str:token>/", views.ConfirmView.as_view()),
]
