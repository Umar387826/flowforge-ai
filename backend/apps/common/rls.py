"""
PostgreSQL Row-Level Security (RLS) & Cryptographic Tenant Verification DDL.
Used by Django migrations and management commands.
"""

TENANT_SCOPED_TABLES = [
    "agents_aiagent",
    "knowledge_knowledgebase",
    "knowledge_documentchunk",
    "documents_document",
    "conversations_conversation",
    "conversations_message",
    "leads_lead",
    "workflows_workflow",
    "workflows_workflowexecution",
    "integrations_integrationconnection",
    "integrations_webhookendpoint",
    "integrations_webhookevent",
    "integrations_synclog",
    "billing_subscription",
    "billing_usagerecord",
    "billing_invoicehistory",
    "audit_auditlog",
    "notifications_notification",
]

RLS_CORE_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS security;
REVOKE ALL ON SCHEMA security FROM PUBLIC;

CREATE TABLE IF NOT EXISTS security.tenant_signing_keys (
    id INTEGER PRIMARY KEY DEFAULT 1,
    hmac_secret TEXT NOT NULL,
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT single_active_key CHECK (id = 1)
);
REVOKE ALL ON TABLE security.tenant_signing_keys FROM PUBLIC;

-- Verify HMAC-SHA256 signed tenant token:
-- <org_uuid>:<actor_uuid>:<exp_unix_ts>:<nonce>:<hex_hmac_sha256>
CREATE OR REPLACE FUNCTION public.verify_tenant_token()
RETURNS TABLE(org_id UUID, actor_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, security, pg_temp
AS $$
DECLARE
    raw_token TEXT;
    parts TEXT[];
    v_org_str TEXT;
    v_actor_str TEXT;
    v_exp_str TEXT;
    v_nonce TEXT;
    v_sig TEXT;
    v_exp BIGINT;
    v_now BIGINT;
    v_secret TEXT;
    v_payload TEXT;
    v_expected_sig TEXT;
BEGIN
    raw_token := current_setting('app.tenant_token', true);
    IF raw_token IS NULL OR raw_token = '' THEN
        RETURN;
    END IF;

    parts := string_to_array(raw_token, ':');
    IF array_length(parts, 1) IS DISTINCT FROM 5 THEN
        RETURN;
    END IF;

    v_org_str := parts[1];
    v_actor_str := parts[2];
    v_exp_str := parts[3];
    v_nonce := parts[4];
    v_sig := parts[5];

    BEGIN
        v_exp := v_exp_str::BIGINT;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    v_now := extract(epoch FROM clock_timestamp())::BIGINT;
    IF v_exp < v_now OR v_exp > (v_now + 3600) THEN
        RETURN;
    END IF;

    SELECT hmac_secret INTO v_secret FROM security.tenant_signing_keys WHERE id = 1;
    IF v_secret IS NULL OR v_secret = '' THEN
        RETURN;
    END IF;

    v_payload := v_org_str || ':' || v_actor_str || ':' || v_exp_str || ':' || v_nonce;
    v_expected_sig := encode(hmac(convert_to(v_payload, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'), 'hex');

    IF v_expected_sig IS DISTINCT FROM v_sig THEN
        RETURN;
    END IF;

    BEGIN
        org_id := NULLIF(v_org_str, '00000000-0000-0000-0000-000000000000')::UUID;
        actor_id := NULLIF(v_actor_str, '00000000-0000-0000-0000-000000000000')::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, security, pg_temp
AS $$
    SELECT org_id FROM public.verify_tenant_token() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_actor_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, security, pg_temp
AS $$
    SELECT actor_id FROM public.verify_tenant_token() LIMIT 1;
$$;
"""


def build_table_rls_sql(table_name: str) -> str:
    return f"""
    ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
    ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation_policy ON {table_name};
    CREATE POLICY tenant_isolation_policy ON {table_name}
        USING (organization_id = public.current_tenant_id())
        WITH CHECK (organization_id = public.current_tenant_id());
    """


MEMBERSHIP_RLS_SQL = """
ALTER TABLE organizations_organizationmembership ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations_organizationmembership FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_isolation_policy ON organizations_organizationmembership;
CREATE POLICY membership_isolation_policy ON organizations_organizationmembership
    USING (
        organization_id = public.current_tenant_id()
        OR user_id = public.current_actor_id()
    )
    WITH CHECK (
        organization_id = public.current_tenant_id()
        OR user_id = public.current_actor_id()
    );

ALTER TABLE organizations_organizationinvitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations_organizationinvitation FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invitation_isolation_policy ON organizations_organizationinvitation;
CREATE POLICY invitation_isolation_policy ON organizations_organizationinvitation
    USING (organization_id = public.current_tenant_id())
    WITH CHECK (organization_id = public.current_tenant_id());
"""


GRANT_APP_ROLE_SQL = """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flowforge_app') THEN
        REVOKE ALL ON SCHEMA security FROM flowforge_app;
        REVOKE ALL ON TABLE security.tenant_signing_keys FROM flowforge_app;
        GRANT USAGE ON SCHEMA public TO flowforge_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flowforge_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO flowforge_app;
        GRANT EXECUTE ON FUNCTION public.verify_tenant_token() TO flowforge_app;
        GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO flowforge_app;
        GRANT EXECUTE ON FUNCTION public.current_actor_id() TO flowforge_app;
    END IF;
END
$$;
"""

RLS_LOOKUP_HELPERS_SQL = """
-- Minimal SECURITY DEFINER helpers that return ONLY organization_id UUID
-- for unauthenticated/public/webhook entrypoints before entering tenant_context().
CREATE OR REPLACE FUNCTION public.resolve_invitation_org_id(p_token TEXT)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT organization_id
    FROM organizations_organizationinvitation
    WHERE token = p_token AND status = 'pending'
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_agent_org_by_embed_key(p_embed_key TEXT)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT organization_id
    FROM agents_aiagent
    WHERE public_embed_key = p_embed_key
      AND is_active = TRUE
      AND deleted_at IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_conversation_org_id(p_conversation_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT c.organization_id
    FROM conversations_conversation c
    JOIN organizations_organization o ON o.id = c.organization_id
    WHERE c.id = p_conversation_id
      AND c.deleted_at IS NULL
      AND o.deleted_at IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_webhook_endpoint_org_id(p_endpoint_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT organization_id
    FROM integrations_webhookendpoint
    WHERE id = p_endpoint_id
      AND is_active = TRUE
      AND deleted_at IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_subscription_org_id(p_stripe_sub_id TEXT, p_stripe_customer_id TEXT)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT organization_id
    FROM billing_subscription
    WHERE deleted_at IS NULL
      AND (
        (p_stripe_sub_id <> '' AND stripe_subscription_id = p_stripe_sub_id)
        OR (p_stripe_customer_id <> '' AND stripe_customer_id = p_stripe_customer_id)
      )
    LIMIT 1;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flowforge_app') THEN
        GRANT EXECUTE ON FUNCTION public.resolve_invitation_org_id(TEXT) TO flowforge_app;
        GRANT EXECUTE ON FUNCTION public.resolve_agent_org_by_embed_key(TEXT) TO flowforge_app;
        GRANT EXECUTE ON FUNCTION public.resolve_conversation_org_id(UUID) TO flowforge_app;
        GRANT EXECUTE ON FUNCTION public.resolve_webhook_endpoint_org_id(UUID) TO flowforge_app;
        GRANT EXECUTE ON FUNCTION public.resolve_subscription_org_id(TEXT, TEXT) TO flowforge_app;
    END IF;
END
$$;
"""

