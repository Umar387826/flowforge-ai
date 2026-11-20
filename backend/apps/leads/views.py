from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.audit.services import log_audit_event
from apps.common.mixins import TenantModelViewSet
from apps.common.permissions import IsOrganizationManager, IsOrganizationMember
from apps.integrations.hubspot import HubSpotSyncError, sync_lead_to_hubspot
from apps.leads.models import Lead
from apps.leads.services import qualify_lead_with_ai


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "company",
            "preferences",
            "qualification_score",
            "qualification_reason",
            "status",
            "source_conversation",
            "crm_external_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "crm_external_id", "created_at", "updated_at"]


class LeadViewSet(TenantModelViewSet):
    serializer_class = LeadSerializer
    queryset = Lead.objects.all()
    filterset_fields = ["status"]
    search_fields = ["full_name", "email", "company"]

    def get_permissions(self):
        if self.action in ("destroy",):
            return [IsOrganizationManager()]
        return [IsOrganizationMember()]

    def perform_create(self, serializer):
        lead = serializer.save(organization=self.request.organization)
        log_audit_event(
            self.request.organization, self.request.user, "lead.created", "Lead", str(lead.id), request=self.request
        )
        from apps.workflows.engine import dispatch_workflows_for_event

        dispatch_workflows_for_event(
            organization_id=str(self.request.organization.id),
            trigger_type="lead_captured",
            payload={
                "lead_id": str(lead.id),
                "email": lead.email,
                "full_name": lead.full_name,
                "qualification_score": lead.qualification_score,
                "preferences": lead.preferences,
            },
        )

    @action(detail=True, methods=["post"])
    def qualify(self, request, pk=None):
        lead = self.get_object()
        try:
            qualify_lead_with_ai(lead)
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(LeadSerializer(lead).data)

    @action(detail=True, methods=["post"])
    def sync_hubspot(self, request, pk=None):
        lead = self.get_object()
        try:
            result = sync_lead_to_hubspot(request.organization, lead)
        except HubSpotSyncError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"lead": LeadSerializer(lead).data, "hubspot": result})
