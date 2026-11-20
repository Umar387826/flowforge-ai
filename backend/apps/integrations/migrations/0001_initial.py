import uuid
from django.db import migrations, models
import django.db.models.deletion
import apps.integrations.models


class Migration(migrations.Migration):
    initial = True
    dependencies = [("organizations", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="IntegrationConnection",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("provider", models.CharField(choices=[("google_oauth", "Google OAuth 2.0"), ("hubspot", "HubSpot CRM")], max_length=40)),
                ("status", models.CharField(choices=[("connected", "Connected"), ("disconnected", "Disconnected"), ("error", "Error"), ("awaiting_credentials", "Awaiting Credentials")], default="disconnected", max_length=30)),
                ("access_token", models.TextField(blank=True, default="")),
                ("refresh_token", models.TextField(blank=True, default="")),
                ("token_expires_at", models.DateTimeField(blank=True, null=True)),
                ("scopes", models.JSONField(blank=True, default=list)),
                ("account_email", models.EmailField(blank=True, default="", max_length=254)),
                ("field_mapping", models.JSONField(blank=True, default=dict)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("last_error", models.TextField(blank=True, default="")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={"unique_together": {("organization", "provider")}},
        ),
        migrations.CreateModel(
            name="WebhookEndpoint",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("name", models.CharField(max_length=150)),
                ("direction", models.CharField(choices=[("inbound", "Inbound"), ("outbound", "Outbound")], default="inbound", max_length=20)),
                ("url", models.URLField(blank=True, default="")),
                ("signing_secret", models.CharField(default=apps.integrations.models.default_webhook_secret, max_length=120)),
                ("is_active", models.BooleanField(default=True)),
                ("subscribed_events", models.JSONField(blank=True, default=list)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="WebhookEvent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("event_id", models.CharField(db_index=True, max_length=120)),
                ("event_type", models.CharField(max_length=120)),
                ("payload", models.JSONField(default=dict)),
                ("signature_valid", models.BooleanField(default=False)),
                ("status", models.CharField(default="received", max_length=30)),
                ("error_message", models.TextField(blank=True, default="")),
                ("endpoint", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="integrations.webhookendpoint")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={"ordering": ["-created_at"], "unique_together": {("endpoint", "event_id")}},
        ),
        migrations.CreateModel(
            name="SyncLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("provider", models.CharField(max_length=40)),
                ("resource_type", models.CharField(max_length=60)),
                ("resource_id", models.CharField(max_length=120)),
                ("external_id", models.CharField(blank=True, default="", max_length=120)),
                ("status", models.CharField(max_length=30)),
                ("request_payload", models.JSONField(blank=True, default=dict)),
                ("response_payload", models.JSONField(blank=True, default=dict)),
                ("error_message", models.TextField(blank=True, default="")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
