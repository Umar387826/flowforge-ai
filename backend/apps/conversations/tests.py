from unittest.mock import AsyncMock, patch

from channels.layers import InMemoryChannelLayer
from channels.testing import WebsocketCommunicator
from django.test import SimpleTestCase, override_settings

from config.asgi import application


TEST_CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
}


@override_settings(CHANNEL_LAYERS=TEST_CHANNEL_LAYERS)
class WebSocketAuthorizationTests(SimpleTestCase):

    async def test_chat_rejects_unauthorized_connection(self):
        communicator = WebsocketCommunicator(
            application, "/ws/chat/11111111-1111-1111-1111-111111111111/"
        )
        with patch(
            "apps.conversations.consumers._authorize_conversation",
            new=AsyncMock(return_value=None),
        ):
            connected, code = await communicator.connect()

        self.assertFalse(connected)
        self.assertEqual(code, 4403)

    async def test_chat_accepts_authorized_connection(self):
        conversation_id = "11111111-1111-1111-1111-111111111111"
        auth = {
            "organization_id": "22222222-2222-2222-2222-222222222222",
            "conversation_id": conversation_id,
            "agent_id": "33333333-3333-3333-3333-333333333333",
            "user_id": "44444444-4444-4444-4444-444444444444",
        }
        communicator = WebsocketCommunicator(
            application, f"/ws/chat/{conversation_id}/"
        )
        with patch(
            "apps.conversations.consumers._authorize_conversation",
            new=AsyncMock(return_value=auth),
        ):
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            event = await communicator.receive_json_from()
            self.assertEqual(event["type"], "connection_established")
            self.assertEqual(event["conversation_id"], conversation_id)
            await communicator.disconnect()

    async def test_dashboard_rejects_unauthorized_connection(self):
        communicator = WebsocketCommunicator(
            application,
            "/ws/dashboard/?org_id=22222222-2222-2222-2222-222222222222",
        )
        with patch(
            "apps.conversations.consumers._authorize_dashboard_org",
            new=AsyncMock(return_value=None),
        ):
            connected, code = await communicator.connect()

        self.assertFalse(connected)
        self.assertEqual(code, 4403)

    async def test_dashboard_accepts_authorized_connection(self):
        org_id = "22222222-2222-2222-2222-222222222222"
        communicator = WebsocketCommunicator(
            application, f"/ws/dashboard/?org_id={org_id}"
        )
        with patch(
            "apps.conversations.consumers._authorize_dashboard_org",
            new=AsyncMock(return_value=org_id),
        ):
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()
