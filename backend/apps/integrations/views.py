import json
from django.conf import settings
from django.db import IntegrityError
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.audit.services import log_audit_event
from apps.common.mixins import TenantModelViewSet, TenantReadOnlyViewSet
from apps.common.permissions import IsOrganizationAdmin, IsOrganizationMember
from apps.common.tenancy import resolve_webhook_endpoint_org_id, tenant_context
from apps.integrations.google_oauth import (
    GoogleOAuthError,
    build_google_authorize_url,
    exchange_google_code,
    revoke_google_connection,
)
from apps.integrations.hubspot import HubSpotSyncError, build_hubspot_authorize_url, exchange_hubspot_code
from apps.integrations.models import IntegrationConnection, SyncLog, WebhookEndpoint, WebhookEvent
from apps.integrations.webhooks import verify_webhook_signature


class IntegrationConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationConnection
        fields = [
            "id",
            "provider",
            "status",
            "account_email",
            "scopes",
            "field_mapping",
            "token_expires_at",
            "last_error",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "account_email", "scopes", "token_expires_at", "last_error", "updated_at"]


class WebhookEndpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookEndpoint
        fields = [
            "id",
            "name",
            "direction",
            "url",
            "signing_secret",
            "is_active",
            "subscribed_events",
            "created_at",
        ]
        read_only_fields = ["id", "signing_secret", "created_at"]


class SyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncLog
        fields = ["id", "provider", "resource_type", "resource_id", "external_id", "status", "error_message", "created_at"]


class IntegrationViewSet(TenantModelViewSet):
    serializer_class = IntegrationConnectionSerializer
    queryset = IntegrationConnection.objects.all()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "connect", "callback", "disconnect"):
            return [IsOrganizationAdmin()]
        return [IsOrganizationMember()]

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        data = IntegrationConnectionSerializer(qs, many=True).data
        return Response(
            {
                "connections": data,
                "credentials_status": {
                    "google_oauth": bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET),
                    "hubspot_oauth": bool(settings.HUBSPOT_CLIENT_ID and settings.HUBSPOT_CLIENT_SECRET),
                    "hubspot_private_token": bool(settings.HUBSPOT_PRIVATE_APP_TOKEN),
                },
            }
        )

    @action(detail=False, methods=["post"])
    def connect(self, request):
        provider = request.data.get("provider")
        if provider == IntegrationConnection.Provider.GOOGLE_OAUTH:
            try:
                url = build_google_authorize_url(str(request.organization.id), str(request.user.id))
                return Response({"authorize_url": url})
            except GoogleOAuthError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        elif provider == IntegrationConnection.Provider.HUBSPOT:
            if request.data.get("private_token"):
                conn, _ = IntegrationConnection.objects.update_or_create(
                    organization=request.organization,
                    provider=IntegrationConnection.Provider.HUBSPOT,
                    defaults={
                        "status": IntegrationConnection.Status.CONNECTED,
                        "access_token": request.data["private_token"].strip(),
                        "field_mapping": request.data.get("field_mapping") or {},
                        "last_error": "",
                    },
                )
                return Response(IntegrationConnectionSerializer(conn).data)
            try:
                url = build_hubspot_authorize_url(str(request.organization.id))
                return Response({"authorize_url": url})
            except HubSpotSyncError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Unsupported provider."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def callback(self, request):
        provider = request.data.get("provider")
        code = request.data.get("code", "")
        state = request.data.get("state", "")
        if provider == IntegrationConnection.Provider.GOOGLE_OAUTH:
            try:
                conn = exchange_google_code(request.organization, code, state)
                log_audit_event(request.organization, request.user, "integration.google_connected", "IntegrationConnection", str(conn.id), request=request)
                return Response(IntegrationConnectionSerializer(conn).data)
            except GoogleOAuthError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        elif provider == IntegrationConnection.Provider.HUBSPOT:
            try:
                conn = exchange_hubspot_code(request.organization, code, state)
                log_audit_event(request.organization, request.user, "integration.hubspot_connected", "IntegrationConnection", str(conn.id), request=request)
                return Response(IntegrationConnectionSerializer(conn).data)
            except HubSpotSyncError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Unsupported provider."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def disconnect(self, request, pk=None):
        conn = self.get_object()
        if conn.provider == IntegrationConnection.Provider.GOOGLE_OAUTH:
            revoke_google_connection(conn)
        else:
            conn.status = IntegrationConnection.Status.DISCONNECTED
            conn.access_token = ""
            conn.refresh_token = ""
            conn.save(update_fields=["status", "access_token", "refresh_token", "updated_at"])
        return Response(IntegrationConnectionSerializer(conn).data)


class WebhookEndpointViewSet(TenantModelViewSet):
    serializer_class = WebhookEndpointSerializer
    queryset = WebhookEndpoint.objects.all()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsOrganizationAdmin()]
        return [IsOrganizationMember()]


class SyncLogViewSet(TenantReadOnlyViewSet):
    serializer_class = SyncLogSerializer
    queryset = SyncLog.objects.all()
    permission_classes = [IsOrganizationMember]


@method_decorator(csrf_exempt, name="dispatch")
class InboundWebhookReceiveView(APIView):
    """
    Receives signed webhooks, verifies HMAC-SHA256 + timestamp drift,
    prevents replay via unique (endpoint, event_id), persists event, and triggers workflows.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, endpoint_id: str):
        org_id = resolve_webhook_endpoint_org_id(endpoint_id)
        if not org_id:
            return Response({"detail": "Webhook endpoint not found."}, status=status.HTTP_404_NOT_FOUND)

        ts = request.META.get("HTTP_X_FLOWFORGE_TIMESTAMP", "")
        sig = request.META.get("HTTP_X_FLOWFORGE_SIGNATURE", "")
        event_id = request.META.get("HTTP_X_FLOWFORGE_EVENT_ID", "")

        with tenant_context(org_id):
            endpoint = WebhookEndpoint.objects.select_related("organization").filter(
                id=endpoint_id, is_active=True
            ).first()
            if not endpoint:
                return Response({"detail": "Webhook endpoint not found."}, status=status.HTTP_404_NOT_FOUND)

            valid, reason = verify_webhook_signature(endpoint.signing_secret, ts, sig, request.body)
            if not valid:
                return Response({"detail": reason}, status=status.HTTP_401_UNAUTHORIZED)

            if not event_id:
                return Response({"detail": "X-FlowForge-Event-ID header is required for replay protection."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                payload = json.loads(request.body.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                return Response({"detail": "Invalid JSON body."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                evt = WebhookEvent.objects.create(
                    organization=endpoint.organization,
                    endpoint=endpoint,
                    event_id=event_id,
                    event_type=payload.get("event_type", "webhook.received"),
                    payload=payload,
                    signature_valid=True,
                    status="processed",
                )
            except IntegrityError:
                return Response({"detail": "Duplicate webhook event rejected (replay protection)."}, status=status.HTTP_409_CONFLICT)

            from apps.workflows.engine import dispatch_workflows_for_event

            dispatch_workflows_for_event(
                organization_id=str(endpoint.organization_id),
                trigger_type="webhook_received",
                payload={"endpoint_id": str(endpoint.id), "event_id": event_id, **payload},
            )

        return Response({"status": "accepted", "event_id": evt.event_id}, status=status.HTTP_202_ACCEPTED)
