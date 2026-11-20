from django.conf import settings
from django.db import migrations
from apps.common.rls import (
    GRANT_APP_ROLE_SQL,
    MEMBERSHIP_RLS_SQL,
    RLS_CORE_SQL,
    TENANT_SCOPED_TABLES,
    build_table_rls_sql,
)


def apply_rls_policies(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(RLS_CORE_SQL)
        cursor.execute(
            """
            INSERT INTO security.tenant_signing_keys (id, hmac_secret, rotated_at)
            VALUES (1, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                hmac_secret = EXCLUDED.hmac_secret,
                rotated_at = NOW();
            """,
            [settings.TENANT_SIGNING_KEY],
        )
        for table in TENANT_SCOPED_TABLES:
            cursor.execute(build_table_rls_sql(table))
        cursor.execute(MEMBERSHIP_RLS_SQL)
        cursor.execute(GRANT_APP_ROLE_SQL)


def reverse_rls_policies(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        for table in TENANT_SCOPED_TABLES:
            cursor.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
        cursor.execute("ALTER TABLE organizations_organizationmembership DISABLE ROW LEVEL SECURITY;")
        cursor.execute("ALTER TABLE organizations_organizationinvitation DISABLE ROW LEVEL SECURITY;")


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("accounts", "0001_initial"),
        ("organizations", "0001_initial"),
        ("knowledge", "0002_documentchunk"),
        ("documents", "0001_initial"),
        ("agents", "0001_initial"),
        ("conversations", "0001_initial"),
        ("leads", "0001_initial"),
        ("workflows", "0001_initial"),
        ("integrations", "0001_initial"),
        ("billing", "0001_initial"),
        ("audit", "0001_initial"),
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(apply_rls_policies, reverse_rls_policies),
    ]
