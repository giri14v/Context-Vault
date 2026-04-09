from django.urls import path
from .views import ReminderCreateView, DueRemindersView, mark_reminder_sent

urlpatterns = [
    path("", ReminderCreateView.as_view(), name="reminder-create"),
    path("due/", DueRemindersView.as_view(), name="reminders-due"),
    path("<int:pk>/sent/", mark_reminder_sent, name="reminder-mark-sent"),
]