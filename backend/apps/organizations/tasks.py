from celery import shared_task
from django.utils import timezone
from apps.common.tenancy import tenant_context
from apps.organizations.models import Organization, OrganizationInvitation


@shared_task(name="apps.organizations.tasks.cleanup_expired_invitations")
def cleanup_expired_invitations():
    now = timezone.now()
    total_updated = 0
    org_ids = list(Organization.objects.filter(deleted_at__isnull=True).values_list("id", flat=True))
    for org_id in org_ids:
        with tenant_context(org_id):
            total_updated += OrganizationInvitation.objects.filter(
                organization_id=org_id,
                status=OrganizationInvitation.Status.PENDING,
                expires_at__lt=now,
            ).update(status=OrganizationInvitation.Status.EXPIRED)
    return {"expired_invitations_updated": total_updated}
