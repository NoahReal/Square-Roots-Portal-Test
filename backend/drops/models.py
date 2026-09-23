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


class DropCycle(models.Model):
    """One round of ordering and drops, roughly every two weeks (e.g. "October 3 drop").

    Step 2 of the plan adds per-site cutoffs and drop dates; for now each cycle has one of each.
    """

    name = models.CharField(max_length=100)
    drop_date = models.DateField()
    order_cutoff = models.DateTimeField(help_text="Community Managers must order by this time.")

    class Meta:
        ordering = ["-drop_date"]

    def __str__(self):
        return self.name
