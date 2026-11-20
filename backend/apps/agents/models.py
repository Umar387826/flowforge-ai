import secrets
from django.db import models
from apps.common.models import TenantScopedModel
from apps.knowledge.models import KnowledgeBase


def default_embed_key():
    return f"ff_pub_{secrets.token_urlsafe(24)}"


class AIAgent(TenantScopedModel):
    class Provider(models.TextChoices):
        ANTHROPIC = "anthropic", "Anthropic"
        OPENAI = "openai", "OpenAI"

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")
    system_instructions = models.TextField(
        default="You are a helpful AI assistant. Answer questions accurately using only the provided knowledge base context."
    )
    llm_provider = models.CharField(max_length=30, choices=Provider.choices, default=Provider.ANTHROPIC)
    model_name = models.CharField(max_length=80, default="claude-3-5-sonnet-20241022")
    temperature = models.FloatField(default=0.2)
    max_tokens = models.IntegerField(default=1024)
    is_active = models.BooleanField(default=True, db_index=True)
    knowledge_bases = models.ManyToManyField(KnowledgeBase, blank=True, related_name="agents")
    enabled_tools = models.JSONField(default=list, blank=True)  # e.g. ["capture_lead", "search_knowledge"]
    widget_config = models.JSONField(
        default=dict,
        blank=True,
    )
    public_embed_key = models.CharField(max_length=80, unique=True, default=default_embed_key, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
