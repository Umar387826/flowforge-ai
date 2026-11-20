from django.conf import settings
from django.db import connection
from django.http import JsonResponse
import redis


def health_check(request):
    return JsonResponse({"status": "ok", "service": "flowforge-backend"})


def readiness_check(request):
    checks = {"database": "error", "pgvector": "error", "redis": "error"}
    healthy = True

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            checks["database"] = "ok"
            if connection.vendor == "postgresql":
                cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
                checks["pgvector"] = "ok" if cursor.fetchone() else "missing"
            else:
                checks["pgvector"] = "skipped"
    except Exception:
        healthy = False

    try:
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        if r.ping():
            checks["redis"] = "ok"
    except Exception:
        healthy = False

    return JsonResponse(
        {"status": "ready" if healthy else "degraded", "checks": checks},
        status=200 if healthy else 503,
    )
