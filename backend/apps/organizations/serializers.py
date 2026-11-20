from rest_framework import serializers
from apps.accounts.serializers import UserSerializer
from apps.organizations.models import Organization, OrganizationInvitation, OrganizationMembership


class OrganizationSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "industry", "website", "settings", "role", "created_at", "updated_at"]
        read_only_fields = ["id", "slug", "role", "created_at", "updated_at"]

    def get_role(self, obj):
        request = self.context.get("request")
        if request and getattr(request, "membership", None) and request.membership.organization_id == obj.id:
            return request.membership.role
        if request and request.user.is_authenticated:
            m = OrganizationMembership.objects.filter(organization=obj, user=request.user, is_active=True).first()
            return m.role if m else None
        return None


class OrganizationCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    industry = serializers.CharField(max_length=100, required=False, allow_blank=True)
    website = serializers.URLField(required=False, allow_blank=True)


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = ["id", "user", "role", "is_active", "created_at"]
        read_only_fields = ["id", "user", "created_at"]


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=OrganizationMembership.Role.choices, default=OrganizationMembership.Role.MEMBER)


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationInvitation
        fields = ["id", "email", "role", "status", "expires_at", "created_at"]
        read_only_fields = fields
