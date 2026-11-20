import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("organizations", "0001_initial"),
        ("knowledge", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Document",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("title", models.CharField(max_length=255)),
                ("file", models.FileField(upload_to="documents/%Y/%m/")),
                ("mime_type", models.CharField(default="application/pdf", max_length=120)),
                ("file_size", models.BigIntegerField(default=0)),
                ("sha256_checksum", models.CharField(db_index=True, max_length=64)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("processing", "Processing"), ("indexed", "Indexed"), ("failed", "Failed")], db_index=True, default="pending", max_length=20)),
                ("chunk_count", models.IntegerField(default=0)),
                ("celery_task_id", models.CharField(blank=True, default="", max_length=120)),
                ("error_message", models.TextField(blank=True, default="")),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("knowledge_base", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="documents", to="knowledge.knowledgebase")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
                ("uploaded_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="uploaded_documents", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["organization", "status"], name="documents_d_organiz_status_idx"),
                    models.Index(fields=["organization", "sha256_checksum"], name="documents_d_organiz_sha256_idx"),
                ],
            },
        ),
    ]
