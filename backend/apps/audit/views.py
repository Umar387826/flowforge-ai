from rest_framework import serializers
from apps.audit.models import AuditLog
from apps.common.mixins import TenantReadOnlyViewSet
from apps.common.permissions import IsOrganizationMember


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True, default="")

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_email",
            "action",
            "resource_type",
            "resource_id",
            "metadata",
            "ip_address",
            "correlation_id",
            "created_at",
        ]
        read_only_fields = fields


class AuditLogViewSet(TenantReadOnlyViewSet):
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.select_related("actor").all()
    permission_classes = [IsOrganizationMember]
    filterset_fields = ["action", "resource_type"]
    search_fields = ["action", "resource_type", "resource_id", "correlation_id"]
