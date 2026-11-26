import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.db import transaction
import structlog
from apps.agents.services import (
    LEAD_CAPTURE_TOOL_ANTHROPIC,
    LLMProviderError,
    build_grounded_system_prompt,
    get_llm_provider,
    prepare_chat_messages,
)
from apps.billing.models import UsageRecord
from apps.billing.services import QuotaExceededError, enforce_quota, record_usage
from apps.common.tenancy import (
    apply_pg_tenant_token,
    build_signed_tenant_token,
    resolve_conversation_org_id,
    tenant_context,
)
from apps.conversations.models import Conversation, Message
from apps.knowledge.embeddings import EmbeddingProviderError
from apps.knowledge.rag import build_grounded_rag_context, retrieve_relevant_chunks
from apps.leads.services import capture_lead_from_tool
from apps.organizations.models import OrganizationMembership

logger = structlog.get_logger(__name__)


@database_sync_to_async
def _authorize_conversation(conversation_id: str, user, widget_token: str | None) -> dict | None:
    """
    Strictly authorize WebSocket connection without trusting any client-supplied org_id.
    Either:
    - Authenticated user holds active OrganizationMembership in conversation.organization, OR
    - Public widget visitor holds exact visitor_session_token for a widget conversation.
    """
    org_id = resolve_conversation_org_id(conversation_id)
    if not org_id:
        return None

    with tenant_context(org_id):
        conv = Conversation.objects.select_related("organization", "agent").filter(
            id=conversation_id, organization__deleted_at__isnull=True
        ).first()
        if not conv:
            return None
        if user and getattr(user, "is_authenticated", False):
            is_member = OrganizationMembership.objects.filter(
                organization_id=conv.organization_id, user=user, is_active=True
            ).exists()
            if not is_member:
                return None
            return {
                "organization_id": str(conv.organization_id),
                "conversation_id": str(conv.id),
                "agent_id": str(conv.agent_id),
                "user_id": str(user.id),
            }

        if widget_token and conv.channel == Conversation.Channel.WIDGET and conv.visitor_session_token == widget_token:
            return {
                "organization_id": str(conv.organization_id),
                "conversation_id": str(conv.id),
                "agent_id": str(conv.agent_id),
                "user_id": None,
            }

    return None


@database_sync_to_async
def _authorize_dashboard_org(user, org_id: str | None) -> str | None:
    if not user or not getattr(user, "is_authenticated", False) or not org_id:
        return None
    actor_token = build_signed_tenant_token(None, actor_id=user.id)
    with transaction.atomic():
        apply_pg_tenant_token(actor_token)
        membership = OrganizationMembership.objects.filter(
            organization_id=org_id, user=user, is_active=True
        ).first()
        return str(membership.organization_id) if membership else None


@database_sync_to_async
def _save_user_message_and_fetch_context(org_id: str, conv_id: str, user_id: str | None, text: str) -> dict:
    with tenant_context(org_id, actor_id=user_id):
        conv = Conversation.objects.select_related("organization", "agent").get(id=conv_id)
        enforce_quota(conv.organization, UsageRecord.Metric.AI_REQUESTS, 1)

        user_msg = Message.objects.create(
            organization=conv.organization,
            conversation=conv,
            sender_id=user_id,
            role=Message.Role.USER,
            content=text,
        )

        history = list(
            Message.objects.filter(conversation=conv).order_by("created_at").values("role", "content")
        )
        kb_ids = list(conv.agent.knowledge_bases.values_list("id", flat=True))
        citations = []
        rag_context = "NO_RELEVANT_DOCUMENTS_FOUND: No knowledge base attached."
        if kb_ids:
            chunks = retrieve_relevant_chunks(conv.organization_id, kb_ids, text)
            rag_context, citations = build_grounded_rag_context(chunks)

        system_prompt = build_grounded_system_prompt(conv.agent, rag_context)
        tools = [LEAD_CAPTURE_TOOL_ANTHROPIC] if "capture_lead" in (conv.agent.enabled_tools or []) else None
        return {
            "user_message_id": str(user_msg.id),
            "system_prompt": system_prompt,
            "messages": prepare_chat_messages(history),
            "provider": conv.agent.llm_provider,
            "model": conv.agent.model_name,
            "temperature": conv.agent.temperature,
            "max_tokens": conv.agent.max_tokens,
            "tools": tools,
            "citations": citations,
        }


@database_sync_to_async
def _save_assistant_message_and_process_tools(
    org_id: str, conv_id: str, content: str, citations: list, usage: dict, tool_calls: list
) -> dict:
    with tenant_context(org_id):
        conv = Conversation.objects.select_related("organization").get(id=conv_id)
        msg = Message.objects.create(
            organization=conv.organization,
            conversation=conv,
            role=Message.Role.ASSISTANT,
            content=content,
            citations=citations,
            token_usage=usage,
        )
        record_usage(conv.organization, UsageRecord.Metric.AI_REQUESTS, 1)
        record_usage(conv.organization, UsageRecord.Metric.TOKENS, usage.get("total_tokens", 0))

        captured_lead_id = None
        for tc in tool_calls:
            if tc.get("name") == "capture_lead":
                lead = capture_lead_from_tool(
                    organization=conv.organization,
                    tool_input=tc.get("input") or {},
                    source_conversation=conv,
                )
                if lead:
                    captured_lead_id = str(lead.id)

        return {"assistant_message_id": str(msg.id), "captured_lead_id": captured_lead_id}


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        auth = await _authorize_conversation(
            self.conversation_id,
            self.scope.get("user"),
            self.scope.get("widget_token"),
        )
        if not auth:
            await self.close(code=4403)
            return

        self.auth_ctx = auth
        self.room_group_name = f"chat_{auth['organization_id']}_{self.conversation_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({"type": "connection_established", "conversation_id": self.conversation_id}))

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            payload = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"type": "error", "detail": "Invalid JSON payload."}))
            return

        msg_type = payload.get("type", "chat_message")
        if msg_type == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))
            return

        content = (payload.get("content") or "").strip()
        if not content:
            await self.send(text_data=json.dumps({"type": "error", "detail": "Empty message."}))
            return

        # Broadcast user message to all participants in this tenant conversation room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_broadcast",
                "event": {"type": "user_message", "content": content, "sender_id": self.auth_ctx["user_id"]},
            },
        )

        # Skip AI auto-reply if explicitly marked human_only
        if payload.get("skip_ai"):
            return

        try:
            ctx = await _save_user_message_and_fetch_context(
                self.auth_ctx["organization_id"],
                self.conversation_id,
                self.auth_ctx["user_id"],
                content,
            )
        except QuotaExceededError as exc:
            await self.send(text_data=json.dumps({"type": "error", "code": "quota_exceeded", "detail": str(exc.detail)}))
            return
        except EmbeddingProviderError as exc:
            await self.send(text_data=json.dumps({"type": "error", "detail": str(exc)}))
            return

        provider = get_llm_provider(ctx["provider"])
        full_answer = ""
        usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        tool_calls = []

        try:
            for chunk in provider.stream(
                system_prompt=ctx["system_prompt"],
                messages=ctx["messages"],
                model=ctx["model"],
                temperature=ctx["temperature"],
                max_tokens=ctx["max_tokens"],
                tools=ctx["tools"],
            ):
                if chunk["type"] == "token":
                    full_answer += chunk["text"]
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            "type": "chat_broadcast",
                            "event": {"type": "assistant_token", "token": chunk["text"]},
                        },
                    )
                elif chunk["type"] == "done":
                    resp = chunk["response"]
                    full_answer = resp.content or full_answer
                    usage = {
                        "input_tokens": resp.input_tokens,
                        "output_tokens": resp.output_tokens,
                        "total_tokens": resp.input_tokens + resp.output_tokens,
                    }
                    tool_calls = resp.tool_calls
        except LLMProviderError as exc:
            await self.send(text_data=json.dumps({"type": "error", "detail": str(exc)}))
            return

        saved = await _save_assistant_message_and_process_tools(
            self.auth_ctx["organization_id"],
            self.conversation_id,
            full_answer,
            ctx["citations"],
            usage,
            tool_calls,
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_broadcast",
                "event": {
                    "type": "assistant_complete",
                    "message_id": saved["assistant_message_id"],
                    "content": full_answer,
                    "citations": ctx["citations"],
                    "token_usage": usage,
                    "captured_lead_id": saved["captured_lead_id"],
                },
            },
        )

    async def chat_broadcast(self, event):
        await self.send(text_data=json.dumps(event["event"]))


class DashboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        from urllib.parse import parse_qs

        params = parse_qs(self.scope.get("query_string", b"").decode("utf-8"))
        org_id = (params.get("org_id") or [None])[0]
        verified_org_id = await _authorize_dashboard_org(self.scope.get("user"), org_id)
        if not verified_org_id:
            await self.close(code=4403)
            return
        self.group_name = f"dashboard_{verified_org_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def dashboard_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
