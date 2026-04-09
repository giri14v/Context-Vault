from django.db import models
from django.db import models
from django.contrib.auth.models import User


class Context(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="contexts")
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "name")

    def __str__(self):
        return f"{self.user.username} — {self.name}"


class Bookmark(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookmarks")
    url = models.URLField(max_length=2000)
    title = models.CharField(max_length=500)
    notes = models.TextField(blank=True)
    contexts = models.ManyToManyField(Context, through="BookmarkContext", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "url")  # duplicate detection

    def __str__(self):
        return f"{self.user.username} — {self.title}"


class BookmarkContext(models.Model):
    bookmark = models.ForeignKey(Bookmark, on_delete=models.CASCADE)
    context = models.ForeignKey(Context, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("bookmark", "context")