from django.urls import include, path
from rest_framework.routers import DefaultRouter
from apps.agents.views import AIAgentViewSet

router = DefaultRouter()
router.register("", AIAgentViewSet, basename="agents")

urlpatterns = [path("", include(router.urls))]
