from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.agents.models import AIAgent
from apps.agents.services import (
    LEAD_CAPTURE_TOOL_ANTHROPIC,
    LLMProviderError,
    build_grounded_system_prompt,
    get_llm_provider,
)
from apps.audit.services import log_audit_event
from apps.billing.models import UsageRecord
from apps.billing.services import enforce_quota, record_usage
from apps.common.mixins import TenantModelViewSet
from apps.common.permissions import IsOrganizationManager, IsOrganizationMember
from apps.knowledge.embeddings import EmbeddingProviderError
from apps.knowledge.models import KnowledgeBase
from apps.knowledge.rag import build_grounded_rag_context, retrieve_relevant_chunks
from apps.leads.services import capture_lead_from_tool


class AIAgentSerializer(serializers.ModelSerializer):
    knowledge_base_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        source="knowledge_bases",
        queryset=KnowledgeBase.all_objects.all(),
        required=False,
    )

    class Meta:
        model = AIAgent
        fields = [
            "id",
            "name",
            "description",
            "system_instructions",
            "llm_provider",
            "model_name",
            "temperature",
            "max_tokens",
            "is_active",
            "knowledge_base_ids",
            "enabled_tools",
            "widget_config",
            "public_embed_key",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "public_embed_key", "created_at", "updated_at"]

    def validate_knowledge_base_ids(self, kbs):
        request = self.context.get("request")
        if request and getattr(request, "organization", None):
            for kb in kbs:
                if kb.organization_id != request.organization.id:
                    raise serializers.ValidationError("Cannot attach a knowledge base from another organization.")
        return kbs


class AIAgentViewSet(TenantModelViewSet):
    serializer_class = AIAgentSerializer
    queryset = AIAgent.objects.prefetch_related("knowledge_bases").all()
    filterset_fields = ["is_active", "llm_provider"]
    search_fields = ["name", "description"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "toggle_active"):
            return [IsOrganizationManager()]
        return [IsOrganizationMember()]

    def perform_create(self, serializer):
        enforce_quota(self.request.organization, "agents", 1)
        agent = serializer.save(organization=self.request.organization)
        log_audit_event(
            self.request.organization, self.request.user, "agent.created", "AIAgent", str(agent.id), request=self.request
        )

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        agent = self.get_object()
        agent.is_active = not agent.is_active
        agent.save(update_fields=["is_active", "updated_at"])
        return Response(AIAgentSerializer(agent, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def test_query(self, request, pk=None):
        agent = self.get_object()
        prompt = request.data.get("message", "").strip()
        if not prompt:
            return Response({"detail": "message is required."}, status=status.HTTP_400_BAD_REQUEST)

        enforce_quota(request.organization, UsageRecord.Metric.AI_REQUESTS, 1)

        kb_ids = list(agent.knowledge_bases.values_list("id", flat=True))
        citations = []
        rag_context = "NO_RELEVANT_DOCUMENTS_FOUND: No knowledge base attached."
        if kb_ids:
            try:
                chunks = retrieve_relevant_chunks(request.organization.id, kb_ids, prompt)
                rag_context, citations = build_grounded_rag_context(chunks)
            except EmbeddingProviderError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        system_prompt = build_grounded_system_prompt(agent, rag_context)
        tools = [LEAD_CAPTURE_TOOL_ANTHROPIC] if "capture_lead" in (agent.enabled_tools or []) else None
        provider = get_llm_provider(agent.llm_provider)

        try:
            llm_resp = provider.generate(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": prompt}],
                model=agent.model_name,
                temperature=agent.temperature,
                max_tokens=agent.max_tokens,
                tools=tools,
            )
        except LLMProviderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        total_tokens = llm_resp.input_tokens + llm_resp.output_tokens
        record_usage(request.organization, UsageRecord.Metric.AI_REQUESTS, 1)
        record_usage(request.organization, UsageRecord.Metric.TOKENS, total_tokens)

        captured_lead_ids = []
        for tc in llm_resp.tool_calls:
            if tc.get("name") == "capture_lead":
                lead = capture_lead_from_tool(
                    organization=request.organization,
                    tool_input=tc.get("input") or {},
                )
                if lead:
                    captured_lead_ids.append(str(lead.id))

        answer = llm_resp.content
        if not answer and captured_lead_ids:
            answer = "Lead captured successfully."

        return Response(
            {
                "answer": answer,
                "citations": citations,
                "token_usage": {
                    "input_tokens": llm_resp.input_tokens,
                    "output_tokens": llm_resp.output_tokens,
                    "total_tokens": total_tokens,
                },
                "tool_calls": llm_resp.tool_calls,
                "captured_lead_ids": captured_lead_ids,
            }
        )
