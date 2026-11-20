from django.db import models
from apps.common.models import TenantScopedModel


class Lead(TenantScopedModel):
    class Status(models.TextChoices):
        NEW = "new", "New"
        QUALIFIED = "qualified", "Qualified"
        DISQUALIFIED = "disqualified", "Disqualified"
        SYNCED = "synced", "Synced to CRM"

    full_name = models.CharField(max_length=150, blank=True, default="")
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=50, blank=True, default="")
    company = models.CharField(max_length=150, blank=True, default="")
    preferences = models.JSONField(default=dict, blank=True)
    qualification_score = models.IntegerField(default=0)
    qualification_reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW, db_index=True)
    source_conversation = models.ForeignKey(
        "conversations.Conversation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
    )
    crm_external_id = models.CharField(max_length=120, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "email"]),
        ]
