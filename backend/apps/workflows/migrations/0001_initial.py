import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [("organizations", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="Workflow",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("name", models.CharField(max_length=150)),
                ("description", models.TextField(blank=True, default="")),
                ("trigger_type", models.CharField(choices=[("lead_captured", "New Lead Captured"), ("new_conversation", "New Chat Conversation"), ("ai_event", "Specific AI Event"), ("webhook_received", "Webhook Received"), ("scheduled", "Scheduled Event"), ("document_indexed", "Document Processing Completed")], db_index=True, max_length=40)),
                ("trigger_config", models.JSONField(blank=True, default=dict)),
                ("conditions", models.JSONField(blank=True, default=dict)),
                ("actions", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="WorkflowExecution",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("idempotency_key", models.CharField(db_index=True, max_length=120)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("running", "Running"), ("succeeded", "Succeeded"), ("skipped", "Skipped (Condition False)"), ("failed", "Failed")], db_index=True, default="pending", max_length=30)),
                ("trigger_payload", models.JSONField(default=dict)),
                ("step_logs", models.JSONField(blank=True, default=list)),
                ("error_message", models.TextField(blank=True, default="")),
                ("retry_count", models.IntegerField(default=0)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
                ("workflow", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="executions", to="workflows.workflow")),
            ],
            options={"ordering": ["-created_at"], "unique_together": {("organization", "workflow", "idempotency_key")}},
        ),
    ]
