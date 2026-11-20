from django.db import migrations
from apps.common.rls import RLS_LOOKUP_HELPERS_SQL


def apply_lookup_helpers(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(RLS_LOOKUP_HELPERS_SQL)


def reverse_lookup_helpers(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            DROP FUNCTION IF EXISTS public.resolve_invitation_org_id(TEXT);
            DROP FUNCTION IF EXISTS public.resolve_agent_org_by_embed_key(TEXT);
            DROP FUNCTION IF EXISTS public.resolve_conversation_org_id(UUID);
            DROP FUNCTION IF EXISTS public.resolve_webhook_endpoint_org_id(UUID);
            DROP FUNCTION IF EXISTS public.resolve_subscription_org_id(TEXT, TEXT);
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0001_enable_rls"),
    ]

    operations = [
        migrations.RunPython(apply_lookup_helpers, reverse_lookup_helpers),
    ]
