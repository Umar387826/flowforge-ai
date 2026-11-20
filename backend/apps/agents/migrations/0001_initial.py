import uuid
from django.db import migrations, models
import django.db.models.deletion
import apps.agents.models


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("organizations", "0001_initial"),
        ("knowledge", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AIAgent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("name", models.CharField(max_length=150)),
                ("description", models.TextField(blank=True, default="")),
                ("system_instructions", models.TextField(default="You are a helpful AI assistant. Answer questions accurately using only the provided knowledge base context.")),
                ("llm_provider", models.CharField(choices=[("anthropic", "Anthropic"), ("openai", "OpenAI")], default="anthropic", max_length=30)),
                ("model_name", models.CharField(default="claude-3-5-sonnet-20241022", max_length=80)),
                ("temperature", models.FloatField(default=0.2)),
                ("max_tokens", models.IntegerField(default=1024)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("enabled_tools", models.JSONField(blank=True, default=list)),
                ("widget_config", models.JSONField(blank=True, default=dict)),
                ("public_embed_key", models.CharField(db_index=True, default=apps.agents.models.default_embed_key, max_length=80, unique=True)),
                ("knowledge_bases", models.ManyToManyField(blank=True, related_name="agents", to="knowledge.knowledgebase")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
