from django.urls import path

from . import views

urlpatterns = [
    path("produce/", views.ProduceListView.as_view()),
    path("produce/<int:pk>/", views.ProduceDetailView.as_view()),
    path("orders/", views.FarmOrderListView.as_view()),
    path("orders/<int:pk>/confirm/", views.ConfirmOrderView.as_view()),
    path("orders/<int:pk>/cant-fill/", views.CantFillOrderView.as_view()),
]
