import uuid
from django.db import migrations, models
import django.db.models.deletion
from pgvector.django import HnswIndex, VectorExtension, VectorField


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("organizations", "0001_initial"),
    ]

    operations = [
        VectorExtension(),
        migrations.CreateModel(
            name="KnowledgeBase",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("name", models.CharField(max_length=150)),
                ("description", models.TextField(blank=True, default="")),
                ("embedding_model", models.CharField(default="text-embedding-3-small", max_length=80)),
                ("chunk_size", models.IntegerField(default=800)),
                ("chunk_overlap", models.IntegerField(default=120)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={"ordering": ["-created_at"], "unique_together": {("organization", "name")}},
        ),
    ]
