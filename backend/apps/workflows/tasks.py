from celery import shared_task
from apps.common.tenancy import tenant_context
from apps.workflows.engine import run_workflow_execution
from apps.workflows.models import WorkflowExecution


@shared_task(
    bind=True,
    name="apps.workflows.tasks.execute_workflow_task",
    queue="workflows",
    autoretry_for=(RuntimeError, ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=120,
    max_retries=3,
    acks_late=True,
)
def execute_workflow_task(self, execution_id: str, organization_id: str):
    with tenant_context(organization_id):
        WorkflowExecution.objects.filter(id=execution_id).update(retry_count=self.request.retries)
    return run_workflow_execution(execution_id, organization_id)
