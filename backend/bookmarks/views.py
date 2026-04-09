from django.shortcuts import render
from rest_framework import generics, permissions
from .models import Bookmark, Context
from .serializers import BookmarkSerializer, ContextSerializer


class ContextListCreateView(generics.ListCreateAPIView):
    serializer_class = ContextSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Context.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BookmarkListCreateView(generics.ListCreateAPIView):
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user).prefetch_related("contexts")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BookmarkDeleteView(generics.DestroyAPIView):
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)
    
class BookmarkDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)  
    
    # def patch(self, request, *args, **kwargs):  # 🔥 Allow partial updates
    #     return self.partial_update(request, *args, **kwargs)