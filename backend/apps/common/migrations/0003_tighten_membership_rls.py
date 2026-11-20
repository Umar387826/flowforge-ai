from django.db import migrations

FORWARD_SQL = """
ALTER POLICY membership_isolation_policy
ON public.organizations_organizationmembership
USING (
    organization_id = public.current_tenant_id()
    OR user_id = public.current_actor_id()
)
WITH CHECK (
    organization_id = public.current_tenant_id()
);
"""

REVERSE_SQL = """
ALTER POLICY membership_isolation_policy
ON public.organizations_organizationmembership
USING (
    organization_id = public.current_tenant_id()
    OR user_id = public.current_actor_id()
)
WITH CHECK (
    organization_id = public.current_tenant_id()
    OR user_id = public.current_actor_id()
);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0002_rls_lookup_helpers"),
    ]

    operations = [
        migrations.RunSQL(
            sql=FORWARD_SQL,
            reverse_sql=REVERSE_SQL,
        ),
    ]
