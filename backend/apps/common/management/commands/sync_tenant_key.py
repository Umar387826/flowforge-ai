from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Synchronize TENANT_SIGNING_KEY into security.tenant_signing_keys (run with owner role)"

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            self.stdout.write(self.style.WARNING("Skipping RLS key sync: non-PostgreSQL backend"))
            return

        with connection.cursor() as cursor:
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
        self.stdout.write(self.style.SUCCESS("Synchronized TENANT_SIGNING_KEY to security.tenant_signing_keys"))
