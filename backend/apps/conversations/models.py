import secrets
from django.conf import settings
from django.db import models
from apps.agents.models import AIAgent
from apps.common.models import TenantScopedModel


def default_session_token():
    return secrets.token_urlsafe(32)


class Conversation(TenantScopedModel):
    class Channel(models.TextChoices):
        DASHBOARD = "dashboard", "Dashboard"
        WIDGET = "widget", "Public Widget"
        API = "api", "API"

    agent = models.ForeignKey(AIAgent, on_delete=models.CASCADE, related_name="conversations")
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversations",
    )
    title = models.CharField(max_length=200, default="New Conversation")
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.DASHBOARD)
    visitor_session_token = models.CharField(max_length=120, default=default_session_token, db_index=True)
    visitor_email = models.EmailField(blank=True, default="")
    is_closed = models.BooleanField(default=False)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["organization", "agent"]),
        ]


class Message(TenantScopedModel):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="sent_messages"
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField()
    citations = models.JSONField(default=list, blank=True)
    token_usage = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["organization", "conversation", "created_at"]),
        ]
