from django.urls import include, path
from rest_framework.routers import DefaultRouter
from apps.integrations.views import (
    InboundWebhookReceiveView,
    IntegrationViewSet,
    SyncLogViewSet,
    WebhookEndpointViewSet,
)

router = DefaultRouter()
router.register("connections", IntegrationViewSet, basename="integration-connections")
router.register("webhooks", WebhookEndpointViewSet, basename="webhook-endpoints")
router.register("sync-logs", SyncLogViewSet, basename="sync-logs")

urlpatterns = [
    path("webhooks/inbound/<uuid:endpoint_id>/", InboundWebhookReceiveView.as_view(), name="inbound-webhook"),
    path("", include(router.urls)),
]
