import os
from celery import Celery
from celery.schedules import crontab
from kombu import Queue

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("flowforge")
app.config_from_object("django.conf:settings", namespace="CELERY")

app.conf.task_queues = (
    Queue("default"),
    Queue("documents"),
    Queue("workflows"),
    Queue("integrations"),
)
app.conf.task_default_queue = "default"

app.conf.beat_schedule = {
    "cleanup-expired-invitations-hourly": {
        "task": "apps.organizations.tasks.cleanup_expired_invitations",
        "schedule": crontab(minute=0),
        "options": {"queue": "default"},
    },
    "refresh-expiring-oauth-tokens-every-15m": {
        "task": "apps.integrations.tasks.refresh_expiring_oauth_tokens",
        "schedule": crontab(minute="*/15"),
        "options": {"queue": "integrations"},
    },
    "daily-usage-aggregation": {
        "task": "apps.billing.tasks.rollup_daily_usage_metrics",
        "schedule": crontab(hour=0, minute=15),
        "options": {"queue": "default"},
    },
}

app.autodiscover_tasks()
