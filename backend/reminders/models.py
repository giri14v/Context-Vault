from django.db import models
from django.db import models
from django.contrib.auth.models import User
from bookmarks.models import Bookmark


class Reminder(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reminders")
    bookmark = models.ForeignKey(Bookmark, on_delete=models.CASCADE, related_name="reminders")
    remind_at = models.DateTimeField()
    is_sent = models.BooleanField(default=False)
    repeat_count = models.IntegerField(default=0)  # how many repeats left
    repeat_interval_minutes = models.IntegerField(default=0)  # gap
    created_at = models.DateTimeField(auto_now_add=True)
    

    def __str__(self):
        return f"Reminder for {self.bookmark.title} at {self.remind_at}"
