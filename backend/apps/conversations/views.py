from rest_framework import permissions, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.agents.models import AIAgent
from apps.agents.services import (
    LEAD_CAPTURE_TOOL_ANTHROPIC,
    LLMProviderError,
    build_grounded_system_prompt,
    get_llm_provider,
    prepare_chat_messages,
)
from apps.billing.models import UsageRecord
from apps.billing.services import enforce_quota, record_usage
from apps.common.mixins import TenantModelViewSet
from apps.common.permissions import IsOrganizationMember
from apps.common.tenancy import resolve_agent_org_by_embed_key, tenant_context
from apps.conversations.models import Conversation, Message
from apps.knowledge.embeddings import EmbeddingProviderError
from apps.knowledge.rag import build_grounded_rag_context, retrieve_relevant_chunks
from apps.leads.services import capture_lead_from_tool


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "role", "content", "citations", "token_usage", "created_at"]
        read_only_fields = fields


class ConversationSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.name", read_only=True)
    message_count = serializers.IntegerField(source="messages.count", read_only=True)

    class Meta:
        model = Conversation
        fields = [
            "id",
            "agent",
            "agent_name",
            "title",
            "channel",
            "visitor_email",
            "is_closed",
            "message_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "agent_name", "message_count", "created_at", "updated_at"]


class ConversationViewSet(TenantModelViewSet):
    serializer_class = ConversationSerializer
    queryset = Conversation.objects.select_related("agent").all()
    filterset_fields = ["agent", "channel", "is_closed"]

    def get_permissions(self):
        return [IsOrganizationMember()]

    def perform_create(self, serializer):
        agent = serializer.validated_data["agent"]
        if agent.organization_id != self.request.organization.id:
            raise serializers.ValidationError("Agent does not belong to your organization.")
        conv = serializer.save(organization=self.request.organization, started_by=self.request.user)
        record_usage(self.request.organization, UsageRecord.Metric.CONVERSATIONS, 1)

        from apps.workflows.engine import dispatch_workflows_for_event

        dispatch_workflows_for_event(
            organization_id=str(self.request.organization.id),
            trigger_type="new_conversation",
            payload={"conversation_id": str(conv.id), "agent_id": str(agent.id)},
        )

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        conv = self.get_object()
        msgs = Message.objects.filter(conversation=conv).order_by("created_at")
        return Response(MessageSerializer(msgs, many=True).data)

    @action(detail=True, methods=["post"])
    def send_message(self, request, pk=None):
        """HTTP fallback for sending a chat message (in addition to real-time WebSocket ChatConsumer)."""
        conv = self.get_object()
        content = (request.data.get("content") or "").strip()
        if not content:
            return Response({"detail": "Message content is required."}, status=status.HTTP_400_BAD_REQUEST)

        enforce_quota(request.organization, UsageRecord.Metric.AI_REQUESTS, 1)
        user_msg = Message.objects.create(
            organization=request.organization,
            conversation=conv,
            sender=request.user,
            role=Message.Role.USER,
            content=content,
        )

        history = list(Message.objects.filter(conversation=conv).order_by("created_at").values("role", "content"))
        kb_ids = list(conv.agent.knowledge_bases.values_list("id", flat=True))
        citations = []
        rag_context = "NO_RELEVANT_DOCUMENTS_FOUND: No knowledge base attached."
        if kb_ids:
            try:
                chunks = retrieve_relevant_chunks(request.organization.id, kb_ids, content)
                rag_context, citations = build_grounded_rag_context(chunks)
            except EmbeddingProviderError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        system_prompt = build_grounded_system_prompt(conv.agent, rag_context)
        tools = [LEAD_CAPTURE_TOOL_ANTHROPIC] if "capture_lead" in (conv.agent.enabled_tools or []) else None
        provider = get_llm_provider(conv.agent.llm_provider)

        try:
            llm_resp = provider.generate(
                system_prompt=system_prompt,
                messages=prepare_chat_messages(history),
                model=conv.agent.model_name,
                temperature=conv.agent.temperature,
                max_tokens=conv.agent.max_tokens,
                tools=tools,
            )
        except LLMProviderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        usage = {
            "input_tokens": llm_resp.input_tokens,
            "output_tokens": llm_resp.output_tokens,
            "total_tokens": llm_resp.input_tokens + llm_resp.output_tokens,
        }
        assistant_msg = Message.objects.create(
            organization=request.organization,
            conversation=conv,
            role=Message.Role.ASSISTANT,
            content=llm_resp.content,
            citations=citations,
            token_usage=usage,
        )
        record_usage(request.organization, UsageRecord.Metric.AI_REQUESTS, 1)
        record_usage(request.organization, UsageRecord.Metric.TOKENS, usage["total_tokens"])

        for tc in llm_resp.tool_calls:
            if tc.get("name") == "capture_lead":
                capture_lead_from_tool(
                    organization=request.organization,
                    tool_input=tc.get("input") or {},
                    source_conversation=conv,
                )

        return Response(
            {
                "user_message": MessageSerializer(user_msg).data,
                "assistant_message": MessageSerializer(assistant_msg).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PublicWidgetInitView(APIView):
    """Initialize a public customer-facing chatbot session bound strictly to the agent's organization."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, embed_key: str):
        org_id = resolve_agent_org_by_embed_key(embed_key)
        if not org_id:
            return Response({"detail": "Chatbot not found or inactive."}, status=status.HTTP_404_NOT_FOUND)
        with tenant_context(org_id):
            agent = AIAgent.objects.select_related("organization").filter(
                public_embed_key=embed_key, is_active=True
            ).first()
            if not agent:
                return Response({"detail": "Chatbot not found or inactive."}, status=status.HTTP_404_NOT_FOUND)
            return Response(
                {
                    "agent_name": agent.name,
                    "description": agent.description,
                    "organization_name": agent.organization.name,
                    "widget_config": agent.widget_config,
                }
            )

    def post(self, request, embed_key: str):
        org_id = resolve_agent_org_by_embed_key(embed_key)
        if not org_id:
            return Response({"detail": "Chatbot not found or inactive."}, status=status.HTTP_404_NOT_FOUND)

        with tenant_context(org_id):
            agent = AIAgent.objects.select_related("organization").filter(
                public_embed_key=embed_key, is_active=True
            ).first()
            if not agent:
                return Response({"detail": "Chatbot not found or inactive."}, status=status.HTTP_404_NOT_FOUND)
            conv = Conversation.objects.create(
                organization=agent.organization,
                agent=agent,
                title=f"Widget Chat - {agent.name}",
                channel=Conversation.Channel.WIDGET,
                visitor_email=request.data.get("email", ""),
            )
            record_usage(agent.organization, UsageRecord.Metric.CONVERSATIONS, 1)
            return Response(
                {
                    "conversation_id": str(conv.id),
                    "widget_token": conv.visitor_session_token,
                    "agent_name": agent.name,
                    "widget_config": agent.widget_config,
                },
                status=status.HTTP_201_CREATED,
            )
