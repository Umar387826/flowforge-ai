from apps.audit.models import AuditLog


def log_audit_event(
    organization,
    actor,
    action: str,
    resource_type: str,
    resource_id: str = "",
    metadata: dict | None = None,
    request=None,
):
    ip_address = None
    correlation_id = ""
    if request is not None:
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        ip_address = xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")
        correlation_id = getattr(request, "correlation_id", "") or ""

    return AuditLog.objects.create(
        organization=organization,
        actor=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id),
        metadata=metadata or {},
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
