from django.db import models


class Site(models.Model):
    """A Square Roots location, where a Community Manager runs drops (e.g. "Lower Sackville")."""

    name = models.CharField(max_length=100, unique=True)
    address = models.CharField(max_length=200)
    instagram_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    highlight = models.CharField(max_length=200, blank=True, help_text="Shown under Location Highlights on the public site.")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name
