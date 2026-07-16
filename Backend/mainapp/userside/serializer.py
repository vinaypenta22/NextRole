from rest_framework import serializers
from .models import userModel, Resume, AppliedJob, SavedJob, ChatMessage
from django.contrib.auth.hashers import make_password

class userSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = userModel
        fields = "__all__"
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def validate_email(self, value):
        if userModel.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({
                "confirm_password": "Passwords do not match."
            })
        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        validated_data["password"] = make_password(validated_data["password"])
        return userModel.objects.create(**validated_data)


class ResumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = "__all__"


class AppliedJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppliedJob
        fields = "__all__"


class SavedJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedJob
        fields = "__all__"


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = "__all__"
