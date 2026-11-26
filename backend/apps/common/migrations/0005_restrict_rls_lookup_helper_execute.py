from django.db import migrations


RESTRICT_FUNCTION_ACCESS_SQL = """
REVOKE ALL ON FUNCTION public.resolve_invitation_org_id(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_agent_org_by_embed_key(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_conversation_org_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_webhook_endpoint_org_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_subscription_org_id(TEXT, TEXT) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'flowforge_app'
    ) THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.resolve_invitation_org_id(TEXT) TO flowforge_app';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.resolve_agent_org_by_embed_key(TEXT) TO flowforge_app';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.resolve_conversation_org_id(UUID) TO flowforge_app';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.resolve_webhook_endpoint_org_id(UUID) TO flowforge_app';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.resolve_subscription_org_id(TEXT, TEXT) TO flowforge_app';
    END IF;
END
$$;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0004_refresh_rls_lookup_helpers"),
    ]

    operations = [
        migrations.RunSQL(
            sql=RESTRICT_FUNCTION_ACCESS_SQL,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
