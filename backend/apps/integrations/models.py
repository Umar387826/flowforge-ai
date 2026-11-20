import secrets
from django.db import models
from apps.common.models import TenantScopedModel


def default_webhook_secret():
    return f"whsec_{secrets.token_hex(24)}"


class IntegrationConnection(TenantScopedModel):
    class Provider(models.TextChoices):
        GOOGLE_OAUTH = "google_oauth", "Google OAuth 2.0"
        HUBSPOT = "hubspot", "HubSpot CRM"

    class Status(models.TextChoices):
        CONNECTED = "connected", "Connected"
        DISCONNECTED = "disconnected", "Disconnected"
        ERROR = "error", "Error"
        AWAITING_CREDENTIALS = "awaiting_credentials", "Awaiting Credentials"

    provider = models.CharField(max_length=40, choices=Provider.choices)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DISCONNECTED)
    access_token = models.TextField(blank=True, default="")
    refresh_token = models.TextField(blank=True, default="")
    token_expires_at = models.DateTimeField(null=True, blank=True)
    scopes = models.JSONField(default=list, blank=True)
    account_email = models.EmailField(blank=True, default="")
    field_mapping = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    last_error = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [("organization", "provider")]


class WebhookEndpoint(TenantScopedModel):
    class Direction(models.TextChoices):
        INBOUND = "inbound", "Inbound"
        OUTBOUND = "outbound", "Outbound"

    name = models.CharField(max_length=150)
    direction = models.CharField(max_length=20, choices=Direction.choices, default=Direction.INBOUND)
    url = models.URLField(blank=True, default="")
    signing_secret = models.CharField(max_length=120, default=default_webhook_secret)
    is_active = models.BooleanField(default=True)
    subscribed_events = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-created_at"]


class WebhookEvent(TenantScopedModel):
    endpoint = models.ForeignKey(WebhookEndpoint, on_delete=models.CASCADE, related_name="events")
    event_id = models.CharField(max_length=120, db_index=True)
    event_type = models.CharField(max_length=120)
    payload = models.JSONField(default=dict)
    signature_valid = models.BooleanField(default=False)
    status = models.CharField(max_length=30, default="received")
    error_message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("endpoint", "event_id")]


class SyncLog(TenantScopedModel):
    provider = models.CharField(max_length=40)
    resource_type = models.CharField(max_length=60)
    resource_id = models.CharField(max_length=120)
    external_id = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=30)  # success | failed
    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
