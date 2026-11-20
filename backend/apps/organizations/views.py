import secrets
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.audit.services import log_audit_event
from apps.billing.services import ensure_free_subscription
from apps.common.mixins import TenantScopedMixin
from apps.common.permissions import IsOrganizationAdmin, IsOrganizationMember, IsOrganizationOwner
from apps.common.tenancy import (
    apply_pg_tenant_token,
    build_signed_tenant_token,
    resolve_invitation_org_id,
    tenant_context,
)
from apps.organizations.models import Organization, OrganizationInvitation, OrganizationMembership
from apps.organizations.serializers import (
    InvitationCreateSerializer,
    InvitationSerializer,
    MembershipSerializer,
    OrganizationCreateSerializer,
    OrganizationSerializer,
)


class OrganizationListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        actor_token = build_signed_tenant_token(None, actor_id=request.user.id)
        with transaction.atomic():
            apply_pg_tenant_token(actor_token)
            memberships = OrganizationMembership.objects.select_related("organization").filter(
                user=request.user,
                is_active=True,
                organization__deleted_at__isnull=True,
            )
            orgs = [m.organization for m in memberships]
        serializer = OrganizationSerializer(orgs, many=True, context={"request": request})
        return Response(serializer.data)

    @transaction.atomic
    def post(self, request):
        serializer = OrganizationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"].strip()
        slug = f"{slugify(name) or 'org'}-{secrets.token_hex(3)}"
        org = Organization.objects.create(
            name=name,
            slug=slug,
            industry=serializer.validated_data.get("industry", ""),
            website=serializer.validated_data.get("website", ""),
            created_by=request.user,
            settings={
                "currency": getattr(settings, "DEFAULT_CURRENCY", "PKR"),
                "timezone": getattr(settings, "DEFAULT_TIMEZONE", "Asia/Karachi"),
                "date_format": getattr(settings, "DEFAULT_DATE_FORMAT", "DD-MM-YYYY"),
            },
        )
        with tenant_context(org.id, actor_id=request.user.id):
            OrganizationMembership.objects.create(
                organization=org,
                user=request.user,
                role=OrganizationMembership.Role.OWNER,
                is_active=True,
            )
            ensure_free_subscription(org)
            log_audit_event(org, request.user, "organization.created", "Organization", str(org.id), request=request)

        return Response(
            OrganizationSerializer(org, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CurrentOrganizationView(TenantScopedMixin, APIView):
    permission_classes = [IsOrganizationMember]

    def get(self, request):
        return Response(OrganizationSerializer(request.organization, context={"request": request}).data)

    def patch(self, request):
        if request.membership.role not in (OrganizationMembership.Role.OWNER, OrganizationMembership.Role.ADMIN):
            return Response({"detail": "Admin or Owner role required."}, status=status.HTTP_403_FORBIDDEN)
        serializer = OrganizationSerializer(
            request.organization, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit_event(
            request.organization, request.user, "organization.updated", "Organization", str(request.organization.id), request=request
        )
        return Response(serializer.data)


class SwitchOrganizationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        org_id = request.data.get("organization_id")
        actor_token = build_signed_tenant_token(None, actor_id=request.user.id)
        with transaction.atomic():
            apply_pg_tenant_token(actor_token)
            membership = OrganizationMembership.objects.select_related("organization").filter(
                user=request.user,
                organization_id=org_id,
                is_active=True,
                organization__deleted_at__isnull=True,
            ).first()
        if not membership:
            return Response(
                {"detail": "You do not belong to that organization."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(
            {
                "organization": OrganizationSerializer(membership.organization, context={"request": request}).data,
                "role": membership.role,
            }
        )


class MembershipViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    serializer_class = MembershipSerializer
    queryset = OrganizationMembership.objects.select_related("user").all()
    http_method_names = ["get", "patch", "delete"]

    def get_permissions(self):
        if self.action in ("partial_update", "update", "destroy"):
            return [IsOrganizationAdmin()]
        return [IsOrganizationMember()]

    def partial_update(self, request, *args, **kwargs):
        membership = self.get_object()
        new_role = request.data.get("role")
        if new_role == OrganizationMembership.Role.OWNER and request.membership.role != OrganizationMembership.Role.OWNER:
            return Response({"detail": "Only Owners can assign Owner role."}, status=status.HTTP_403_FORBIDDEN)
        if membership.role == OrganizationMembership.Role.OWNER and request.membership.role != OrganizationMembership.Role.OWNER:
            return Response({"detail": "Only Owners can modify another Owner."}, status=status.HTTP_403_FORBIDDEN)
        response = super().partial_update(request, *args, **kwargs)
        log_audit_event(
            request.organization, request.user, "membership.updated", "OrganizationMembership", str(membership.id),
            metadata={"role": new_role}, request=request
        )
        return response

    def destroy(self, request, *args, **kwargs):
        membership = self.get_object()
        if membership.role == OrganizationMembership.Role.OWNER:
            owner_count = OrganizationMembership.objects.filter(
                organization=request.organization, role=OrganizationMembership.Role.OWNER, is_active=True
            ).count()
            if owner_count <= 1:
                return Response({"detail": "Cannot remove the last organization owner."}, status=status.HTTP_400_BAD_REQUEST)
        log_audit_event(
            request.organization, request.user, "membership.removed", "OrganizationMembership", str(membership.id), request=request
        )
        return super().destroy(request, *args, **kwargs)


class InvitationViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    serializer_class = InvitationSerializer
    queryset = OrganizationInvitation.objects.all()
    http_method_names = ["get", "post", "delete"]

    def get_permissions(self):
        if self.action in ("create", "destroy"):
            return [IsOrganizationAdmin()]
        return [IsOrganizationMember()]

    def create(self, request, *args, **kwargs):
        serializer = InvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        role = serializer.validated_data["role"]
        if role == OrganizationMembership.Role.OWNER and request.membership.role != OrganizationMembership.Role.OWNER:
            return Response({"detail": "Only Owners can invite another Owner."}, status=status.HTTP_403_FORBIDDEN)

        inv = OrganizationInvitation.issue(request.organization, email, role, request.user)
        accept_url = f"{settings.FRONTEND_APP_URL}/accept-invite?token={inv.token}"
        send_mail(
            subject=f"Invitation to join {request.organization.name} on FlowForge AI",
            message=f"You have been invited as {role}. Accept here: {accept_url}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=True,
        )
        log_audit_event(
            request.organization, request.user, "invitation.sent", "OrganizationInvitation", str(inv.id),
            metadata={"email": email, "role": role}, request=request
        )
        return Response(InvitationSerializer(inv).data, status=status.HTTP_201_CREATED)


class AcceptInvitationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        token = request.data.get("token", "")
        if not token:
            return Response({"detail": "Invalid or expired invitation token."}, status=status.HTTP_400_BAD_REQUEST)

        org_id = resolve_invitation_org_id(token)
        if not org_id:
            return Response({"detail": "Invalid or expired invitation token."}, status=status.HTTP_400_BAD_REQUEST)

        with tenant_context(org_id, actor_id=request.user.id):
            inv = OrganizationInvitation.objects.select_related("organization").filter(
                token=token, status=OrganizationInvitation.Status.PENDING
            ).first()
            if not inv or inv.expires_at < timezone.now():
                return Response({"detail": "Invalid or expired invitation token."}, status=status.HTTP_400_BAD_REQUEST)
            if inv.email.lower() != request.user.email.lower():
                return Response({"detail": "Invitation email does not match signed-in account."}, status=status.HTTP_403_FORBIDDEN)

            membership, _ = OrganizationMembership.objects.update_or_create(
                organization=inv.organization,
                user=request.user,
                defaults={"role": inv.role, "is_active": True},
            )
            inv.status = OrganizationInvitation.Status.ACCEPTED
            inv.save(update_fields=["status", "updated_at"])
            log_audit_event(
                inv.organization, request.user, "invitation.accepted", "OrganizationMembership", str(membership.id), request=request
            )
            return Response({"organization_id": str(inv.organization_id), "role": membership.role})
