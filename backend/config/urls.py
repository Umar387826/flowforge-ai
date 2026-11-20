from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from apps.common.health import health_check, readiness_check

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", health_check, name="health-check"),
    path("api/v1/ready/", readiness_check, name="readiness-check"),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/organizations/", include("apps.organizations.urls")),
    path("api/v1/agents/", include("apps.agents.urls")),
    path("api/v1/knowledge/", include("apps.knowledge.urls")),
    path("api/v1/documents/", include("apps.documents.urls")),
    path("api/v1/conversations/", include("apps.conversations.urls")),
    path("api/v1/leads/", include("apps.leads.urls")),
    path("api/v1/workflows/", include("apps.workflows.urls")),
    path("api/v1/integrations/", include("apps.integrations.urls")),
    path("api/v1/billing/", include("apps.billing.urls")),
    path("api/v1/analytics/", include("apps.analytics.urls")),
    path("api/v1/audit/", include("apps.audit.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
]
