from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from apps.accounts.models import User


@database_sync_to_async
def _get_user_from_jwt(token_str: str):
    try:
        access = AccessToken(token_str)
        user_id = access["user_id"]
        return User.objects.filter(id=user_id, is_active=True).first() or AnonymousUser()
    except Exception:
        return AnonymousUser()


class JWTAndWidgetAuthMiddleware(BaseMiddleware):
    """
    Authenticates WebSocket connections via ?token=<jwt> (or Authorization header)
    and optionally carries ?widget_token=<visitor_session_token> for public chatbot embeds.
    Never trusts client-supplied organization IDs.
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        params = parse_qs(query_string)
        token = (params.get("token") or [None])[0]
        if not token:
            headers = dict(scope.get("headers", []))
            auth_header = headers.get(b"authorization", b"").decode("utf-8")
            if auth_header.lower().startswith("bearer "):
                token = auth_header[7:].strip()

        scope["user"] = await _get_user_from_jwt(token) if token else AnonymousUser()
        scope["widget_token"] = (params.get("widget_token") or [None])[0]
        return await super().__call__(scope, receive, send)
