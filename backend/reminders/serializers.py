from rest_framework import serializers
from .models import Reminder
from bookmarks.serializers import BookmarkSerializer

class ReminderSerializer(serializers.ModelSerializer):
    # 🔥 ROBUST FIX: Direct method fields (bypasses BookmarkSerializer read_only_fields)
    bookmark_url = serializers.SerializerMethodField()
    bookmark_title = serializers.SerializerMethodField()
    
    bookmark = BookmarkSerializer(read_only=True)
    bookmark_id = serializers.PrimaryKeyRelatedField(
        queryset=__import__("bookmarks.models", fromlist=["Bookmark"]).Bookmark.objects.none(),
        write_only=True,
        source="bookmark",
    )

    class Meta:
        model = Reminder
        fields = (
            "id", 
            "bookmark", 
            "bookmark_id", 
            "bookmark_url",      # ✅ Always works
            "bookmark_title",    # ✅ Always works
            "remind_at", 
            "is_sent", 
            "repeat_count", 
            "repeat_interval_minutes", 
            "created_at"
        )
        read_only_fields = ("id", "is_sent", "created_at", "bookmark_url", "bookmark_title")

    def get_bookmark_url(self, obj):
        """🔥 Direct DB access - ALWAYS works regardless of BookmarkSerializer"""
        return obj.bookmark.url if obj.bookmark else ""

    def get_bookmark_title(self, obj):
        """🔥 Direct DB access - safe fallback"""
        return obj.bookmark.title if obj.bookmark else "Saved Bookmark"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            from bookmarks.models import Bookmark
            self.fields["bookmark_id"].queryset = Bookmark.objects.filter(user=request.user)