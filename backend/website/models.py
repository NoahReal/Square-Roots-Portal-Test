from django.db import models


class ContactMessage(models.Model):
    """A message sent from the public Contact Us page."""

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} <{self.email}>"


class Event(models.Model):
    """An event shown on the public Events page, like a free produce giveaway."""

    title = models.CharField(max_length=150)
    starts_on = models.DateField()
    ends_on = models.DateField(null=True, blank=True, help_text="For events over more than one day.")
    time_text = models.CharField(max_length=100, blank=True, help_text="e.g. 12 to 4 p.m.")
    location = models.CharField(max_length=200, blank=True)
    description = models.TextField()
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ["starts_on"]

    def __str__(self):
        return self.title
