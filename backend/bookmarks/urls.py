from django.urls import path
from .views import BookmarkListCreateView, BookmarkDeleteView, ContextListCreateView, BookmarkDetailView

urlpatterns = [
    path("", BookmarkListCreateView.as_view(), name="bookmark-list-create"),
    path("<int:pk>/", BookmarkDetailView.as_view(), name="bookmarks"),
    path("contexts/", ContextListCreateView.as_view(), name="context-list-create"),
]