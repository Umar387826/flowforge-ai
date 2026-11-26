
import logging

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def flowforge_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get("request")
    correlation_id = getattr(request, "correlation_id", None) if request else None

    if response is not None:
        detail = response.data
        message = "Request failed"

        if isinstance(detail, dict) and "detail" in detail:
            message = str(detail["detail"])
        elif isinstance(detail, list) and detail:
            message = str(detail[0])

        response.data = {
            "error": {
                "code": response.status_code,
                "message": message,
                "details": detail,
                "correlation_id": correlation_id,
            }
        }
        return response

    logger.error(
        "Unhandled API exception. Correlation ID: %s",
        correlation_id,
        exc_info=(type(exc), exc, exc.__traceback__),
    )

    return Response(
        {
            "error": {
                "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "message": "Internal server error",
                "details": None,
                "correlation_id": correlation_id,
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
