import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [("organizations", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="StripeWebhookEvent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("stripe_event_id", models.CharField(db_index=True, max_length=120, unique=True)),
                ("event_type", models.CharField(max_length=120)),
                ("payload", models.JSONField(default=dict)),
                ("processed_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="Subscription",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("plan_tier", models.CharField(choices=[("free", "Free"), ("pro", "Pro"), ("business", "Business")], default="free", max_length=20)),
                ("status", models.CharField(choices=[("active", "Active"), ("trialing", "Trialing"), ("past_due", "Past Due"), ("canceled", "Canceled"), ("incomplete", "Incomplete")], default="active", max_length=20)),
                ("stripe_customer_id", models.CharField(blank=True, db_index=True, default="", max_length=120)),
                ("stripe_subscription_id", models.CharField(blank=True, db_index=True, default="", max_length=120)),
                ("current_period_start", models.DateTimeField(blank=True, null=True)),
                ("current_period_end", models.DateTimeField(blank=True, null=True)),
                ("cancel_at_period_end", models.BooleanField(default=False)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(condition=models.Q(("deleted_at__isnull", True)), fields=("organization",), name="unique_active_org_subscription")
                ]
            },
        ),
        migrations.CreateModel(
            name="UsageRecord",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("period_ym", models.CharField(db_index=True, max_length=7)),
                ("metric", models.CharField(choices=[("ai_requests", "AI Requests"), ("tokens", "LLM Tokens"), ("conversations", "Conversations"), ("workflow_executions", "Workflow Executions"), ("api_calls", "API Calls"), ("storage_bytes", "Document Storage Bytes")], db_index=True, max_length=40)),
                ("quantity", models.BigIntegerField(default=0)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={"unique_together": {("organization", "period_ym", "metric")}},
        ),
        migrations.CreateModel(
            name="InvoiceHistory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("stripe_invoice_id", models.CharField(max_length=120, unique=True)),
                ("amount_paid_cents", models.IntegerField(default=0)),
                ("currency", models.CharField(default="usd", max_length=10)),
                ("status", models.CharField(default="paid", max_length=40)),
                ("invoice_pdf_url", models.URLField(blank=True, default="")),
                ("period_start", models.DateTimeField(blank=True, null=True)),
                ("period_end", models.DateTimeField(blank=True, null=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
