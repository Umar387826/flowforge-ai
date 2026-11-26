from django.db import migrations

from apps.common.rls import RLS_LOOKUP_HELPERS_SQL


def refresh_lookup_helpers(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(RLS_LOOKUP_HELPERS_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0003_tighten_membership_rls"),
    ]

    operations = [
        migrations.RunPython(
            refresh_lookup_helpers,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
