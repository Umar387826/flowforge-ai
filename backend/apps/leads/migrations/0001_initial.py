import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("organizations", "0001_initial"),
        ("conversations", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Lead",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("full_name", models.CharField(blank=True, default="", max_length=150)),
                ("email", models.EmailField(db_index=True, max_length=254)),
                ("phone", models.CharField(blank=True, default="", max_length=50)),
                ("company", models.CharField(blank=True, default="", max_length=150)),
                ("preferences", models.JSONField(blank=True, default=dict)),
                ("qualification_score", models.IntegerField(default=0)),
                ("qualification_reason", models.TextField(blank=True, default="")),
                ("status", models.CharField(choices=[("new", "New"), ("qualified", "Qualified"), ("disqualified", "Disqualified"), ("synced", "Synced to CRM")], db_index=True, default="new", max_length=20)),
                ("crm_external_id", models.CharField(blank=True, default="", max_length=120)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
                ("source_conversation", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="leads", to="conversations.conversation")),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["organization", "status"], name="leads_org_status_idx"),
                    models.Index(fields=["organization", "email"], name="leads_org_email_idx"),
                ],
            },
        ),
    ]
