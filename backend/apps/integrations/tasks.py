from datetime import timedelta
from celery import shared_task
from django.utils import timezone
from apps.common.tenancy import tenant_context
from apps.integrations.google_oauth import refresh_google_token
from apps.integrations.models import IntegrationConnection


@shared_task(name="apps.integrations.tasks.refresh_expiring_oauth_tokens", queue="integrations")
def refresh_expiring_oauth_tokens():
    cutoff = timezone.now() + timedelta(minutes=20)
    conns = IntegrationConnection.all_objects.filter(
        provider=IntegrationConnection.Provider.GOOGLE_OAUTH,
        status=IntegrationConnection.Status.CONNECTED,
        token_expires_at__lte=cutoff,
    )
    refreshed = 0
    for conn in conns:
        with tenant_context(conn.organization_id):
            try:
                refresh_google_token(conn)
                refreshed += 1
            except Exception:
                pass
    return {"refreshed_tokens": refreshed}
