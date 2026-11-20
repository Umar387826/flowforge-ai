from django.db import models
from pgvector.django import HnswIndex, VectorField
from apps.common.models import TenantScopedModel


class KnowledgeBase(TenantScopedModel):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")
    embedding_model = models.CharField(max_length=80, default="text-embedding-3-small")
    chunk_size = models.IntegerField(default=800)
    chunk_overlap = models.IntegerField(default=120)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("organization", "name")]

    def __str__(self):
        return f"{self.name} ({self.organization_id})"


class DocumentChunk(TenantScopedModel):
    knowledge_base = models.ForeignKey(
        KnowledgeBase, on_delete=models.CASCADE, related_name="chunks"
    )
    document = models.ForeignKey(
        "documents.Document", on_delete=models.CASCADE, related_name="chunks"
    )
    chunk_index = models.IntegerField()
    content = models.TextField()
    token_count = models.IntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    embedding = VectorField(dimensions=1536)

    class Meta:
        ordering = ["document", "chunk_index"]
        unique_together = [("document", "chunk_index")]
        indexes = [
            models.Index(fields=["organization", "knowledge_base"]),
            HnswIndex(
                name="doc_chunk_embedding_hnsw_idx",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
        ]
