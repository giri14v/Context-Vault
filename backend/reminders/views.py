from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from .models import Reminder
from .serializers import ReminderSerializer


class ReminderCreateView(generics.CreateAPIView):
    serializer_class = ReminderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DueRemindersView(generics.ListAPIView):
    serializer_class = ReminderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only return due + unsent — do NOT mark as sent here
        return Reminder.objects.filter(
            user=self.request.user,
            remind_at__lte=timezone.now(),
            is_sent=False,
        ).select_related("bookmark")


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def mark_reminder_sent(request, pk):
    try:
        reminder = Reminder.objects.get(pk=pk, user=request.user)
    except Reminder.DoesNotExist:
        return Response({"detail": "Not found."}, status=404)

    reminder.is_sent = True
    reminder.save()

    # 🔁 Handle repeat logic - FIXED for repeat_count: 0
    if reminder.repeat_count > 0 and reminder.repeat_interval_minutes > 0:
        Reminder.objects.create(
            user=reminder.user,
            bookmark=reminder.bookmark,
            remind_at=reminder.remind_at + timedelta(minutes=reminder.repeat_interval_minutes),
            repeat_count=reminder.repeat_count - 1,  # ✅ Decrements properly
            repeat_interval_minutes=reminder.repeat_interval_minutes,
        )

    return Response({"detail": "Marked as sent."})