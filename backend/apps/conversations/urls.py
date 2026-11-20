from django.urls import include, path
from rest_framework.routers import DefaultRouter
from apps.conversations.views import ConversationViewSet, PublicWidgetInitView

router = DefaultRouter()
router.register("", ConversationViewSet, basename="conversations")

urlpatterns = [
    path("widget/<str:embed_key>/", PublicWidgetInitView.as_view(), name="public-widget-init"),
    path("", include(router.urls)),
]
