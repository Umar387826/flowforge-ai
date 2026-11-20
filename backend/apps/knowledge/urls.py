from django.urls import include, path
from rest_framework.routers import DefaultRouter
from apps.knowledge.views import KnowledgeBaseViewSet

router = DefaultRouter()
router.register("", KnowledgeBaseViewSet, basename="knowledge-bases")

urlpatterns = [path("", include(router.urls))]
