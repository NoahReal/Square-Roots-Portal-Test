from django.urls import path

from . import views

urlpatterns = [
    path("", views.SiteListView.as_view()),
]
