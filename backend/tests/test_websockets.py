import asyncio
import pytest
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import RefreshToken
from apps.agents.models import AIAgent
from apps.common.tenancy import tenant_context
from apps.conversations.models import Conversation
from config.asgi import application


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_websocket_auth_cross_tenant_rejection_and_concurrent_chat(create_org_with_owner):
    org_a, user_a = create_org_with_owner("ws_a@test.com", "WS Org A")
    org_b, user_b = create_org_with_owner("ws_b@test.com", "WS Org B")

    with tenant_context(org_a.id, actor_id=user_a.id):
        agent_a = AIAgent.objects.create(organization=org_a, name="WS Agent A")
        conv_a = Conversation.objects.create(organization=org_a, agent=agent_a, started_by=user_a)

    token_a = str(RefreshToken.for_user(user_a).access_token)
    token_b = str(RefreshToken.for_user(user_b).access_token)

    # Cross-tenant User B cannot connect to Org A conversation
    comm_b = WebsocketCommunicator(application, f"/ws/chat/{conv_a.id}/?token={token_b}")
    connected_b, _ = await comm_b.connect()
    assert connected_b is False

    # Unauthenticated connection rejected
    comm_anon = WebsocketCommunicator(application, f"/ws/chat/{conv_a.id}/")
    connected_anon, _ = await comm_anon.connect()
    assert connected_anon is False

    # Authorized User A connects and exchanges real-time messages concurrently
    comm_a1 = WebsocketCommunicator(application, f"/ws/chat/{conv_a.id}/?token={token_a}")
    comm_a2 = WebsocketCommunicator(application, f"/ws/chat/{conv_a.id}/?token={token_a}")
    ok1, _ = await comm_a1.connect()
    ok2, _ = await comm_a2.connect()
    assert ok1 is True and ok2 is True

    _ = await comm_a1.receive_json_from()  # connection_established
    _ = await comm_a2.receive_json_from()

    await comm_a1.send_json_to({"type": "chat_message", "content": "Hello from tab 1", "skip_ai": True})
    msg1 = await comm_a1.receive_json_from()
    msg2 = await comm_a2.receive_json_from()
    assert msg1["content"] == "Hello from tab 1"
    assert msg2["content"] == "Hello from tab 1"

    await asyncio.gather(comm_a1.disconnect(), comm_a2.disconnect())
