from django.conf import settings
from django.db import models
from apps.common.models import TenantScopedModel
from apps.knowledge.models import KnowledgeBase


class Document(TenantScopedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        INDEXED = "indexed", "Indexed"
        FAILED = "failed", "Failed"

    knowledge_base = models.ForeignKey(
        KnowledgeBase, on_delete=models.CASCADE, related_name="documents"
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="uploaded_documents"
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="documents/%Y/%m/")
    mime_type = models.CharField(max_length=120, default="application/pdf")
    file_size = models.BigIntegerField(default=0)
    sha256_checksum = models.CharField(max_length=64, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    chunk_count = models.IntegerField(default=0)
    celery_task_id = models.CharField(max_length=120, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "sha256_checksum"]),
        ]
