from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.common.mixins import TenantModelViewSet
from apps.common.permissions import IsOrganizationMember
from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "message", "level", "is_read", "metadata", "created_at"]
        read_only_fields = ["id", "title", "message", "level", "metadata", "created_at"]


class NotificationViewSet(TenantModelViewSet):
    serializer_class = NotificationSerializer
    queryset = Notification.objects.all()
    permission_classes = [IsOrganizationMember]
    http_method_names = ["get", "patch", "post"]

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=["is_read", "updated_at"])
        return Response(NotificationSerializer(notif).data)
