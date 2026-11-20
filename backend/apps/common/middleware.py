import uuid
import structlog
from django.utils.deprecation import MiddlewareMixin

logger = structlog.get_logger(__name__)


class CorrelationIDMiddleware(MiddlewareMixin):
    def process_request(self, request):
        corr_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        request.correlation_id = corr_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            correlation_id=corr_id,
            method=request.method,
            path=request.path,
        )

    def process_response(self, request, response):
        corr_id = getattr(request, "correlation_id", None)
        if corr_id:
            response["X-Correlation-ID"] = corr_id
        return response


class TenantContextMiddleware(MiddlewareMixin):
    """
    Extracts requested organization header for downstream DRF tenant views
    and ensures request-scoped attributes start clean.
    Actual cryptographic DB binding occurs inside TenantViewMixin after JWT auth
    verifies active OrganizationMembership.
    """

    def process_request(self, request):
        request.organization = None
        request.membership = None
        request.requested_org_id = request.headers.get("X-Organization-ID")
