from contextlib import contextmanager
from contextvars import ContextVar
import hashlib
import hmac
import secrets
import time
import uuid
from django.conf import settings
from django.db import connection, transaction

NULL_UUID = "00000000-0000-0000-0000-000000000000"

_active_tenant_id: ContextVar[str | None] = ContextVar("active_tenant_id", default=None)
_active_actor_id: ContextVar[str | None] = ContextVar("active_actor_id", default=None)


def get_active_tenant_id() -> str | None:
    return _active_tenant_id.get()


def get_active_actor_id() -> str | None:
    return _active_actor_id.get()


def build_signed_tenant_token(
    organization_id: uuid.UUID | str | None,
    actor_id: uuid.UUID | str | None = None,
    ttl_seconds: int | None = None,
    issued_at: int | None = None,
) -> str:
    """
    Create an HMAC-SHA256 signed tenant context token verified inside PostgreSQL RLS.
    Format: <org_uuid>:<actor_uuid>:<exp_unix_ts>:<nonce>:<hex_hmac_sha256>
    """
    org_str = str(uuid.UUID(str(organization_id))) if organization_id else NULL_UUID
    actor_str = str(uuid.UUID(str(actor_id))) if actor_id else NULL_UUID
    ttl = ttl_seconds if ttl_seconds is not None else settings.TENANT_TOKEN_TTL_SECONDS
    now_ts = issued_at if issued_at is not None else int(time.time())
    exp_ts = now_ts + ttl
    nonce = secrets.token_hex(12)

    payload = f"{org_str}:{actor_str}:{exp_ts}:{nonce}"
    sig = hmac.new(
        settings.TENANT_SIGNING_KEY.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}:{sig}"


def verify_signed_tenant_token(token: str) -> tuple[str, str]:
    """
    Python-side verifier mirroring PostgreSQL's verify_tenant_token() logic.
    Raises ValueError if missing, malformed, expired, or tampered.
    Returns (org_uuid_str, actor_uuid_str).
    """
    if not token or not isinstance(token, str):
        raise ValueError("Missing tenant token")
    parts = token.split(":")
    if len(parts) != 5:
        raise ValueError("Malformed tenant token")
    org_str, actor_str, exp_str, nonce, sig = parts

    # Validate UUIDs
    uuid.UUID(org_str)
    uuid.UUID(actor_str)

    try:
        exp_ts = int(exp_str)
    except ValueError as exc:
        raise ValueError("Invalid token expiration") from exc

    now_ts = int(time.time())
    if exp_ts < now_ts:
        raise ValueError("Expired tenant token")
    if exp_ts > now_ts + 3600:
        raise ValueError("Token expiration exceeds maximum allowed window")

    payload = f"{org_str}:{actor_str}:{exp_str}:{nonce}"
    expected_sig = hmac.new(
        settings.TENANT_SIGNING_KEY.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, sig):
        raise ValueError("Invalid tenant token signature")

    return org_str, actor_str


def apply_pg_tenant_token(token: str) -> None:
    """Set transaction-scoped PostgreSQL GUC via SET LOCAL (set_config with is_local=true)."""
    if connection.vendor != "postgresql":
        return
    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('app.tenant_token', %s, true)", [token])


@contextmanager
def tenant_context(
    organization_id: uuid.UUID | str | None,
    actor_id: uuid.UUID | str | None = None,
    ttl_seconds: int | None = None,
):
    """
    Binds a transaction-scoped cryptographic tenant authorization context.
    All DB operations inside this block execute inside an atomic transaction
    with PostgreSQL RLS enforcing the signed organization_id.
    """
    org_token_val = str(uuid.UUID(str(organization_id))) if organization_id else None
    actor_token_val = str(uuid.UUID(str(actor_id))) if actor_id else None

    t_tok = _active_tenant_id.set(org_token_val)
    a_tok = _active_actor_id.set(actor_token_val)
    try:
        signed_token = build_signed_tenant_token(organization_id, actor_id, ttl_seconds=ttl_seconds)
        with transaction.atomic():
            apply_pg_tenant_token(signed_token)
            yield signed_token
    finally:
        _active_tenant_id.reset(t_tok)
        _active_actor_id.reset(a_tok)


def _call_pg_uuid_resolver(sql: str, params: list) -> uuid.UUID | None:
    if connection.vendor != "postgresql":
        return None
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        row = cursor.fetchone()
        return row[0] if row and row[0] else None


def resolve_invitation_org_id(token: str) -> uuid.UUID | None:
    if connection.vendor == "postgresql":
        return _call_pg_uuid_resolver("SELECT public.resolve_invitation_org_id(%s)", [token])
    from apps.organizations.models import OrganizationInvitation

    inv = OrganizationInvitation.objects.filter(token=token, status=OrganizationInvitation.Status.PENDING).first()
    return inv.organization_id if inv else None


def resolve_agent_org_by_embed_key(embed_key: str) -> uuid.UUID | None:
    if connection.vendor == "postgresql":
        return _call_pg_uuid_resolver("SELECT public.resolve_agent_org_by_embed_key(%s)", [embed_key])
    from apps.agents.models import AIAgent

    agent = AIAgent.all_objects.filter(public_embed_key=embed_key, is_active=True, deleted_at__isnull=True).first()
    return agent.organization_id if agent else None


def resolve_conversation_org_id(conversation_id: str) -> uuid.UUID | None:
    try:
        conv_uuid = str(uuid.UUID(str(conversation_id)))
    except ValueError:
        return None
    if connection.vendor == "postgresql":
        return _call_pg_uuid_resolver("SELECT public.resolve_conversation_org_id(%s::uuid)", [conv_uuid])
    from apps.conversations.models import Conversation

    conv = Conversation.all_objects.filter(
        id=conv_uuid, deleted_at__isnull=True, organization__deleted_at__isnull=True
    ).first()
    return conv.organization_id if conv else None


def resolve_webhook_endpoint_org_id(endpoint_id: str) -> uuid.UUID | None:
    try:
        ep_uuid = str(uuid.UUID(str(endpoint_id)))
    except ValueError:
        return None
    if connection.vendor == "postgresql":
        return _call_pg_uuid_resolver("SELECT public.resolve_webhook_endpoint_org_id(%s::uuid)", [ep_uuid])
    from apps.integrations.models import WebhookEndpoint

    ep = WebhookEndpoint.all_objects.filter(id=ep_uuid, is_active=True, deleted_at__isnull=True).first()
    return ep.organization_id if ep else None


def resolve_subscription_org_id(stripe_sub_id: str = "", stripe_customer_id: str = "") -> uuid.UUID | None:
    if connection.vendor == "postgresql":
        return _call_pg_uuid_resolver(
            "SELECT public.resolve_subscription_org_id(%s, %s)",
            [stripe_sub_id or "", stripe_customer_id or ""],
        )
    from apps.billing.models import Subscription

    sub = None
    if stripe_sub_id:
        sub = Subscription.all_objects.filter(stripe_subscription_id=stripe_sub_id, deleted_at__isnull=True).first()
    if not sub and stripe_customer_id:
        sub = Subscription.all_objects.filter(stripe_customer_id=stripe_customer_id, deleted_at__isnull=True).first()
    return sub.organization_id if sub else None

