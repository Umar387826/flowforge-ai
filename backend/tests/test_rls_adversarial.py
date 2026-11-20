import time
import uuid
import pytest
from django.db import connection, transaction
from apps.common.tenancy import build_signed_tenant_token, tenant_context, verify_signed_tenant_token
from apps.leads.models import Lead


def test_signed_tenant_token_rejects_tampered_expired_and_forged():
    org_id = str(uuid.uuid4())
    actor_id = str(uuid.uuid4())
    valid_token = build_signed_tenant_token(org_id, actor_id, ttl_seconds=30)
    parsed_org, parsed_actor = verify_signed_tenant_token(valid_token)
    assert parsed_org == org_id
    assert parsed_actor == actor_id

    # Tamper org UUID
    parts = valid_token.split(":")
    tampered = ":".join([str(uuid.uuid4()), *parts[1:]])
    with pytest.raises(ValueError, match="Invalid tenant token signature"):
        verify_signed_tenant_token(tampered)

    # Expired token
    expired = build_signed_tenant_token(org_id, actor_id, ttl_seconds=5, issued_at=int(time.time()) - 100)
    with pytest.raises(ValueError, match="Expired tenant token"):
        verify_signed_tenant_token(expired)

    # Missing/malformed
    with pytest.raises(ValueError):
        verify_signed_tenant_token("not-a-valid-token")


@pytest.mark.django_db
def test_rls_blocks_cross_tenant_crud_and_forged_db_context(create_org_with_owner):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL RLS database-boundary test requires PostgreSQL")

    org_a, _ = create_org_with_owner("rls_a@test.com", "RLS Org A")
    org_b, _ = create_org_with_owner("rls_b@test.com", "RLS Org B")

    with tenant_context(org_a.id):
        lead_a = Lead.objects.create(organization=org_a, email="lead_a@example.com", full_name="Lead A")

    with tenant_context(org_b.id):
        # Cross-tenant SELECT returns 0 rows
        assert Lead.all_objects.filter(id=lead_a.id).count() == 0
        # Cross-tenant UPDATE affects 0 rows
        assert Lead.all_objects.filter(id=lead_a.id).update(full_name="Hacked") == 0
        # Cross-tenant DELETE affects 0 rows
        assert Lead.all_objects.filter(id=lead_a.id).delete()[0] == 0
        # Cross-tenant INSERT violates RLS WITH CHECK
        with pytest.raises(Exception):
            with transaction.atomic():
                Lead.objects.create(organization=org_a, email="forged@example.com")

    # Verify runtime role cannot read security.tenant_signing_keys or forge token
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.tenant_token', 'forged:0:0:nonce:bad', true)")
            assert Lead.all_objects.count() == 0
            with pytest.raises(Exception):
                cursor.execute("SELECT hmac_secret FROM security.tenant_signing_keys")


@pytest.mark.django_db
def test_rls_lookup_helpers_resolve_only_matching_org(create_org_with_owner):
    from apps.agents.models import AIAgent
    from apps.common.tenancy import (
        resolve_agent_org_by_embed_key,
        resolve_conversation_org_id,
        resolve_invitation_org_id,
        resolve_webhook_endpoint_org_id,
    )
    from apps.conversations.models import Conversation
    from apps.integrations.models import WebhookEndpoint
    from apps.organizations.models import OrganizationInvitation, OrganizationMembership

    org_a, owner_a = create_org_with_owner("lookup_a@test.com", "Lookup Org A")
    with tenant_context(org_a.id, actor_id=owner_a.id):
        agent = AIAgent.objects.create(organization=org_a, name="Lookup Agent")
        conv = Conversation.objects.create(
            organization=org_a, agent=agent, title="Widget", channel=Conversation.Channel.WIDGET
        )
        inv = OrganizationInvitation.issue(org_a, "invitee@test.com", OrganizationMembership.Role.MEMBER, owner_a)
        ep = WebhookEndpoint.objects.create(organization=org_a, name="Inbound Hook")

    assert resolve_agent_org_by_embed_key(agent.public_embed_key) == org_a.id
    assert resolve_agent_org_by_embed_key("nonexistent-embed-key") is None
    assert resolve_conversation_org_id(str(conv.id)) == org_a.id
    assert resolve_invitation_org_id(inv.token) == org_a.id
    assert resolve_webhook_endpoint_org_id(str(ep.id)) == org_a.id
