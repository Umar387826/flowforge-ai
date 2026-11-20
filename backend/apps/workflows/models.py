from django.db import models
from apps.common.models import TenantScopedModel


class Workflow(TenantScopedModel):
    class TriggerType(models.TextChoices):
        LEAD_CAPTURED = "lead_captured", "New Lead Captured"
        NEW_CONVERSATION = "new_conversation", "New Chat Conversation"
        AI_EVENT = "ai_event", "Specific AI Event"
        WEBHOOK_RECEIVED = "webhook_received", "Webhook Received"
        SCHEDULED = "scheduled", "Scheduled Event"
        DOCUMENT_INDEXED = "document_indexed", "Document Processing Completed"

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")
    trigger_type = models.CharField(max_length=40, choices=TriggerType.choices, db_index=True)
    trigger_config = models.JSONField(default=dict, blank=True)
    # {"operator": "AND"|"OR", "rules": [{"field": "qualification_score", "op": "gte", "value": 60}]}
    conditions = models.JSONField(default=dict, blank=True)
    # [{"type": "ai_qualify_lead"|"hubspot_create_contact"|"send_webhook"|"send_notification"|"update_record", "config": {...}}]
    actions = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class WorkflowExecution(TenantScopedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Succeeded"
        SKIPPED = "skipped", "Skipped (Condition False)"
        FAILED = "failed", "Failed"

    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name="executions")
    idempotency_key = models.CharField(max_length=120, db_index=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING, db_index=True)
    trigger_payload = models.JSONField(default=dict)
    step_logs = models.JSONField(default=list, blank=True)
    error_message = models.TextField(blank=True, default="")
    retry_count = models.IntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("organization", "workflow", "idempotency_key")]
