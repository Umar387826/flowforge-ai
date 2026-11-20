import uuid
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.audit.services import log_audit_event
from apps.common.mixins import TenantModelViewSet, TenantReadOnlyViewSet
from apps.common.permissions import IsOrganizationManager, IsOrganizationMember
from apps.workflows.models import Workflow, WorkflowExecution
from apps.workflows.tasks import execute_workflow_task


class WorkflowSerializer(serializers.ModelSerializer):
    execution_count = serializers.IntegerField(source="executions.count", read_only=True)

    class Meta:
        model = Workflow
        fields = [
            "id",
            "name",
            "description",
            "trigger_type",
            "trigger_config",
            "conditions",
            "actions",
            "is_active",
            "execution_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "execution_count", "created_at", "updated_at"]


class WorkflowExecutionSerializer(serializers.ModelSerializer):
    workflow_name = serializers.CharField(source="workflow.name", read_only=True)

    class Meta:
        model = WorkflowExecution
        fields = [
            "id",
            "workflow",
            "workflow_name",
            "idempotency_key",
            "status",
            "trigger_payload",
            "step_logs",
            "error_message",
            "retry_count",
            "created_at",
            "completed_at",
        ]
        read_only_fields = fields


class WorkflowViewSet(TenantModelViewSet):
    serializer_class = WorkflowSerializer
    queryset = Workflow.objects.all()
    filterset_fields = ["trigger_type", "is_active"]
    search_fields = ["name", "description"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "toggle_active", "trigger"):
            return [IsOrganizationManager()]
        return [IsOrganizationMember()]

    def perform_create(self, serializer):
        wf = serializer.save(organization=self.request.organization)
        log_audit_event(
            self.request.organization, self.request.user, "workflow.created", "Workflow", str(wf.id), request=self.request
        )

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        wf = self.get_object()
        wf.is_active = not wf.is_active
        wf.save(update_fields=["is_active", "updated_at"])
        return Response(WorkflowSerializer(wf).data)

    @action(detail=True, methods=["post"])
    def trigger(self, request, pk=None):
        wf = self.get_object()
        payload = request.data.get("payload") or {}
        execution = WorkflowExecution.objects.create(
            organization=request.organization,
            workflow=wf,
            idempotency_key=f"manual_{uuid.uuid4().hex}",
            trigger_payload=payload,
            status=WorkflowExecution.Status.PENDING,
        )
        execute_workflow_task.delay(str(execution.id), str(request.organization.id))
        return Response(WorkflowExecutionSerializer(execution).data, status=status.HTTP_202_ACCEPTED)


class WorkflowExecutionViewSet(TenantReadOnlyViewSet):
    serializer_class = WorkflowExecutionSerializer
    queryset = WorkflowExecution.objects.select_related("workflow").all()
    permission_classes = [IsOrganizationMember]
    filterset_fields = ["workflow", "status"]
