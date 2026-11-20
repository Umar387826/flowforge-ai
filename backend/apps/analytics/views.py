from rest_framework.response import Response
from rest_framework.views import APIView
from apps.agents.models import AIAgent
from apps.billing.services import get_org_plan_limits, get_usage_summary
from apps.common.mixins import TenantScopedMixin
from apps.common.permissions import IsOrganizationMember
from apps.conversations.models import Conversation
from apps.documents.models import Document
from apps.leads.models import Lead
from apps.workflows.models import Workflow, WorkflowExecution


class AnalyticsOverviewView(TenantScopedMixin, APIView):
    permission_classes = [IsOrganizationMember]

    def get(self, request):
        org = request.organization
        usage = get_usage_summary(org)
        limits = get_org_plan_limits(org)

        return Response(
            {
                "kpis": {
                    "active_agents": AIAgent.objects.filter(organization=org, is_active=True).count(),
                    "total_agents": AIAgent.objects.filter(organization=org).count(),
                    "indexed_documents": Document.objects.filter(organization=org, status=Document.Status.INDEXED).count(),
                    "total_conversations": Conversation.objects.filter(organization=org).count(),
                    "total_leads": Lead.objects.filter(organization=org).count(),
                    "qualified_leads": Lead.objects.filter(
                        organization=org, status__in=[Lead.Status.QUALIFIED, Lead.Status.SYNCED]
                    ).count(),
                    "active_workflows": Workflow.objects.filter(organization=org, is_active=True).count(),
                    "successful_workflow_runs": WorkflowExecution.objects.filter(
                        organization=org, status=WorkflowExecution.Status.SUCCEEDED
                    ).count(),
                },
                "usage": usage,
                "limits": limits,
            }
        )
