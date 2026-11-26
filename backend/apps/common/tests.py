from django.test import SimpleTestCase, RequestFactory

from apps.common.middleware import (
    CorrelationIDMiddleware,
    TenantContextMiddleware,
)


class TenantContextMiddlewareTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = TenantContextMiddleware(lambda request: None)

    def test_reads_organization_header(self):
        request = self.factory.get("/", HTTP_X_ORGANIZATION_ID="org-123")
        self.middleware.process_request(request)
        self.assertEqual(request.requested_org_id, "org-123")

    def test_missing_organization_header_is_none(self):
        request = self.factory.get("/")
        self.middleware.process_request(request)
        self.assertIsNone(request.requested_org_id)

    def test_resets_existing_tenant_context(self):
        request = self.factory.get("/")
        request.organization = "old-org"
        request.membership = "old-membership"
        self.middleware.process_request(request)
        self.assertIsNone(request.organization)
        self.assertIsNone(request.membership)


class CorrelationIDMiddlewareTests(SimpleTestCase):
    def test_returns_correlation_id_in_response(self):
        middleware = CorrelationIDMiddleware(lambda request: None)
        request = self.factory_request()
        request.correlation_id = "test-correlation-id"
        response = middleware.process_response(request, self.make_response())
        self.assertEqual(
            response["X-Correlation-ID"],
            "test-correlation-id",
        )

    def factory_request(self):
        return RequestFactory().get("/")

    def make_response(self):
        from django.http import HttpResponse
        return HttpResponse("OK")
