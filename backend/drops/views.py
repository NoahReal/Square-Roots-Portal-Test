from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from .models import Site
from .serializers import SiteSerializer


class SiteListView(ListAPIView):
    """Lists every active Square Roots location. Public: used by the Drop Dates & Locations page and sign-up forms."""

    permission_classes = [AllowAny]
    serializer_class = SiteSerializer
    queryset = Site.objects.filter(is_active=True)
