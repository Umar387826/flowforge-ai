from celery import shared_task
from apps.organizations.models import Organization


@shared_task(name="apps.billing.tasks.rollup_daily_usage_metrics")
def rollup_daily_usage_metrics():
    org_count = Organization.objects.filter(deleted_at__isnull=True).count()
    return {"active_organizations": org_count}
