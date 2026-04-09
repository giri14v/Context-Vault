from rest_framework import serializers
from .models import Bookmark, Context, BookmarkContext


class ContextSerializer(serializers.ModelSerializer):
    class Meta:
        model = Context
        fields = ("id", "name", "created_at")
        read_only_fields = ("id", "created_at")


class BookmarkSerializer(serializers.ModelSerializer):
    contexts = ContextSerializer(many=True, read_only=True)
    context_ids = serializers.PrimaryKeyRelatedField(
        queryset=Context.objects.none(),
        many=True,
        write_only=True,
        required=False,
    )

    class Meta:
        model = Bookmark
        fields = ("id", "url", "title", "notes", "contexts", "context_ids", "created_at")
        read_only_fields = ("id", "created_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["context_ids"].child_relation.queryset = Context.objects.filter(
                user=request.user
            )

    def validate_url(self, value):
        request = self.context.get("request")
        if request and Bookmark.objects.filter(user=request.user, url=value).exists():
            raise serializers.ValidationError("You have already saved this URL.")
        return value

    def create(self, validated_data):
        context_ids = validated_data.pop("context_ids", [])
        bookmark = Bookmark.objects.create(**validated_data)
        for ctx in context_ids:
            BookmarkContext.objects.create(bookmark=bookmark, context=ctx)
        return bookmark
    
    def update(self, instance, validated_data):
        validated_data.pop('url', None)
        context_ids = validated_data.pop("context_ids", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if context_ids is not None:
            instance.contexts.set(context_ids)

        return instance

# class BookmarkSerializer(serializers.ModelSerializer):
#     contexts = ContextSerializer(many=True, read_only=True)
#     context_ids = serializers.PrimaryKeyRelatedField(
#         queryset=Context.objects.none(),
#         many=True,
#         write_only=True,
#         required=False,
#     )

#     class Meta:
#         model = Bookmark
#         fields = ("id", "url", "title", "notes", "contexts", "context_ids", "created_at")
#         read_only_fields = ("id", "created_at", "url")  # 🔥 URL read-only!

#     def __init__(self, *args, **kwargs):
#         super().__init__(*args, **kwargs)
#         request = self.context.get("request")
#         if request:
#             self.fields["context_ids"].child_relation.queryset = Context.objects.filter(
#                 user=request.user
#             )

#     def validate_url(self, value):
#         """🔥 FIXED: Skip validation on UPDATE"""
#         if self.instance:  # UPDATE mode - skip validation
#             return self.instance.url  # Return ORIGINAL URL
        
#         # CREATE mode only
#         request = self.context.get("request")
#         value = value.strip()
#         if request and Bookmark.objects.filter(user=request.user, url=value).exists():
#             raise serializers.ValidationError("You have already saved this URL.")
#         return value

#     def create(self, validated_data):
#         context_ids = validated_data.pop("context_ids", [])
#         bookmark = Bookmark.objects.create(**validated_data)
#         for ctx in context_ids:
#             BookmarkContext.objects.create(bookmark=bookmark, context=ctx)
#         return bookmark
    
#     def update(self, instance, validated_data):
#         # 🔥 URL completely ignored on updates
#         context_ids = validated_data.pop("context_ids", None)
#         validated_data.pop('url', None)  # Double protection
        
#         for attr, value in validated_data.items():
#             setattr(instance, attr, value)
#         instance.save()

#         if context_ids is not None:
#             instance.contexts.set(context_ids)
#         return instance