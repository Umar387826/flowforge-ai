from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.common.permissions import (
    IsOrganizationMember,
    IsOrganizationManager,
    IsOrganizationAdmin,
    IsOrganizationOwner,
)


class OrganizationPermissionTests(SimpleTestCase):
    def make_request(self, role="member", authenticated=True, organization=True, membership=True):
        user = SimpleNamespace(is_authenticated=authenticated)
        return SimpleNamespace(
            user=user,
            organization=object() if organization else None,
            membership=SimpleNamespace(role=role) if membership else None,
        )

    def test_active_member_access(self):
        request = self.make_request("member")
        self.assertTrue(IsOrganizationMember().has_permission(request, None))

    def test_missing_membership_is_rejected(self):
        request = self.make_request(membership=False)
        self.assertFalse(IsOrganizationMember().has_permission(request, None))

    def test_unauthenticated_user_is_rejected(self):
        request = self.make_request(authenticated=False)
        self.assertFalse(IsOrganizationMember().has_permission(request, None))

    def test_member_cannot_access_manager_level(self):
        request = self.make_request("member")
        self.assertFalse(IsOrganizationManager().has_permission(request, None))

    def test_manager_can_access_manager_level(self):
        request = self.make_request("manager")
        self.assertTrue(IsOrganizationManager().has_permission(request, None))

    def test_admin_can_access_admin_level(self):
        request = self.make_request("admin")
        self.assertTrue(IsOrganizationAdmin().has_permission(request, None))

    def test_owner_can_access_admin_and_owner_levels(self):
        request = self.make_request("owner")
        self.assertTrue(IsOrganizationAdmin().has_permission(request, None))
        self.assertTrue(IsOrganizationOwner().has_permission(request, None))

    def test_unknown_role_is_rejected(self):
        request = self.make_request("unknown")
        self.assertFalse(IsOrganizationManager().has_permission(request, None))
