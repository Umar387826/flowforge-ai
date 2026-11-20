from django.db import models
from apps.common.models import TenantScopedModel, TimeStampedModel, UUIDModel


class Subscription(TenantScopedModel):
    class PlanTier(models.TextChoices):
        FREE = "free", "Free"
        PRO = "pro", "Pro"
        BUSINESS = "business", "Business"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        TRIALING = "trialing", "Trialing"
        PAST_DUE = "past_due", "Past Due"
        CANCELED = "canceled", "Canceled"
        INCOMPLETE = "incomplete", "Incomplete"

    plan_tier = models.CharField(max_length=20, choices=PlanTier.choices, default=PlanTier.FREE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    stripe_customer_id = models.CharField(max_length=120, blank=True, default="", db_index=True)
    stripe_subscription_id = models.CharField(max_length=120, blank=True, default="", db_index=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization"],
                condition=models.Q(deleted_at__isnull=True),
                name="unique_active_org_subscription",
            )
        ]


class UsageRecord(TenantScopedModel):
    class Metric(models.TextChoices):
        AI_REQUESTS = "ai_requests", "AI Requests"
        TOKENS = "tokens", "LLM Tokens"
        CONVERSATIONS = "conversations", "Conversations"
        WORKFLOW_EXECUTIONS = "workflow_executions", "Workflow Executions"
        API_CALLS = "api_calls", "API Calls"
        STORAGE_BYTES = "storage_bytes", "Document Storage Bytes"

    period_ym = models.CharField(max_length=7, db_index=True)  # YYYY-MM
    metric = models.CharField(max_length=40, choices=Metric.choices, db_index=True)
    quantity = models.BigIntegerField(default=0)

    class Meta:
        unique_together = [("organization", "period_ym", "metric")]


class StripeWebhookEvent(UUIDModel, TimeStampedModel):
    stripe_event_id = models.CharField(max_length=120, unique=True, db_index=True)
    event_type = models.CharField(max_length=120)
    payload = models.JSONField(default=dict)
    processed_at = models.DateTimeField(auto_now_add=True)


class InvoiceHistory(TenantScopedModel):
    stripe_invoice_id = models.CharField(max_length=120, unique=True)
    amount_paid_cents = models.IntegerField(default=0)
    currency = models.CharField(max_length=10, default="usd")
    status = models.CharField(max_length=40, default="paid")
    invoice_pdf_url = models.URLField(blank=True, default="")
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
