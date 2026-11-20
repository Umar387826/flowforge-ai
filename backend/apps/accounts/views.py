from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.models import PasswordResetToken, User
from apps.accounts.serializers import (
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)
from apps.common.tenancy import apply_pg_tenant_token, build_signed_tenant_token
from apps.organizations.models import OrganizationMembership


def _get_user_organizations(user):
    actor_token = build_signed_tenant_token(None, actor_id=user.id)
    with transaction.atomic():
        apply_pg_tenant_token(actor_token)
        memberships = (
            OrganizationMembership.objects.select_related("organization")
            .filter(user=user, is_active=True, organization__deleted_at__isnull=True)
            .order_by("created_at")
        )
        return [
            {
                "id": str(m.organization.id),
                "name": m.organization.name,
                "slug": m.organization.slug,
                "role": m.role,
            }
            for m in memberships
        ]


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        user = result["user"]
        orgs = _get_user_organizations(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "organizations": orgs,
                "tokens": result["tokens"],
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = data["user"]
        orgs = _get_user_organizations(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "organizations": orgs,
                "tokens": data["tokens"],
            }
        )


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        return Response({"detail": "Logged out successfully."})


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orgs = _get_user_organizations(request.user)
        return Response({"user": UserSerializer(request.user).data, "organizations": orgs})

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"user": serializer.data})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            reset_tok = PasswordResetToken.issue_for_user(user)
            reset_url = f"{settings.FRONTEND_APP_URL}/reset-password?token={reset_tok.token}"
            send_mail(
                subject="FlowForge AI Password Reset",
                message=f"Reset your password using this link: {reset_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        return Response({"detail": "If that email exists, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tok = PasswordResetToken.objects.select_related("user").filter(
            token=serializer.validated_data["token"]
        ).first()
        if not tok or not tok.is_valid():
            return Response({"detail": "Invalid or expired reset token."}, status=status.HTTP_400_BAD_REQUEST)

        tok.user.set_password(serializer.validated_data["new_password"])
        tok.user.save(update_fields=["password", "updated_at"])
        tok.used_at = timezone.now()
        tok.save(update_fields=["used_at"])
        return Response({"detail": "Password has been reset successfully."})


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("token", "")
        user = User.objects.filter(email_verification_token=token).exclude(email_verification_token="").first()
        if not user:
            return Response({"detail": "Invalid verification token."}, status=status.HTTP_400_BAD_REQUEST)
        user.email_verified = True
        user.email_verification_token = ""
        user.save(update_fields=["email_verified", "email_verification_token", "updated_at"])
        return Response({"detail": "Email verified successfully."})


RefreshTokenView = TokenRefreshView
