import secrets
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "avatar_url", "email_verified", "created_at"]
        read_only_fields = ["id", "email", "email_verified", "created_at"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=10)
    organization_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate_password(self, value):
        validate_password(value)
        return value

    @transaction.atomic
    def create(self, validated_data):
        org_name = validated_data.pop("organization_name", "").strip()
        user = User.objects.create_user(
            email=validated_data["email"],
            full_name=validated_data["full_name"].strip(),
            password=validated_data["password"],
            email_verification_token=secrets.token_urlsafe(32),
        )

        created_org = None
        if org_name:
            from django.conf import settings
            from apps.common.tenancy import tenant_context
            from apps.organizations.models import Organization, OrganizationMembership
            from apps.billing.services import ensure_free_subscription

            base_slug = slugify(org_name) or "workspace"
            slug = f"{base_slug}-{secrets.token_hex(3)}"
            created_org = Organization.objects.create(
                name=org_name,
                slug=slug,
                created_by=user,
                settings={
                    "currency": getattr(settings, "DEFAULT_CURRENCY", "PKR"),
                    "timezone": getattr(settings, "DEFAULT_TIMEZONE", "Asia/Karachi"),
                    "date_format": getattr(settings, "DEFAULT_DATE_FORMAT", "DD-MM-YYYY"),
                },
            )
            with tenant_context(created_org.id, actor_id=user.id):
                OrganizationMembership.objects.create(
                    organization=created_org,
                    user=user,
                    role=OrganizationMembership.Role.OWNER,
                    is_active=True,
                )
                ensure_free_subscription(created_org)

        refresh = RefreshToken.for_user(user)
        return {
            "user": user,
            "organization": created_org,
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
        }


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password")
        user = authenticate(username=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled.")
        refresh = RefreshToken.for_user(user)
        return {
            "user": user,
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
        }


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=10)

    def validate_new_password(self, value):
        validate_password(value)
        return value
