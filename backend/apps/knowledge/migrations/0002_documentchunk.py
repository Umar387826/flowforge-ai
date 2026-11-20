import uuid
from django.db import migrations, models
import django.db.models.deletion
from pgvector.django import HnswIndex, VectorField


class Migration(migrations.Migration):
    dependencies = [
        ("knowledge", "0001_initial"),
        ("documents", "0001_initial"),
        ("organizations", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="DocumentChunk",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("chunk_index", models.IntegerField()),
                ("content", models.TextField()),
                ("token_count", models.IntegerField(default=0)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("embedding", VectorField(dimensions=1536)),
                ("document", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="chunks", to="documents.document")),
                ("knowledge_base", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="chunks", to="knowledge.knowledgebase")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={
                "ordering": ["document", "chunk_index"],
                "unique_together": {("document", "chunk_index")},
                "indexes": [
                    models.Index(fields=["organization", "knowledge_base"], name="knowledge_d_organiz_kb_idx"),
                    HnswIndex(fields=["embedding"], m=16, ef_construction=64, name="doc_chunk_embedding_hnsw_idx", opclasses=["vector_cosine_ops"]),
                ],
            },
        ),
    ]
