from django.urls import include, path
from rest_framework.routers import DefaultRouter
from apps.workflows.views import WorkflowExecutionViewSet, WorkflowViewSet

router = DefaultRouter()
router.register("executions", WorkflowExecutionViewSet, basename="workflow-executions")
router.register("", WorkflowViewSet, basename="workflows")

urlpatterns = [path("", include(router.urls))]
