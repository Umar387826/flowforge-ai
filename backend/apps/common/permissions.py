from rest_framework import permissions

ROLE_RANK = {
    "member": 1,
    "manager": 2,
    "admin": 3,
    "owner": 4,
}


class IsOrganizationMember(permissions.BasePermission):
    message = "Active organization membership is required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request, "organization", None) is not None
            and getattr(request, "membership", None) is not None
        )


def require_role(min_role: str):
    class RolePermission(IsOrganizationMember):
        message = f"Organization role '{min_role}' or higher is required."

        def has_permission(self, request, view):
            if not super().has_permission(request, view):
                return False
            user_role = request.membership.role
            return ROLE_RANK.get(user_role, 0) >= ROLE_RANK.get(min_role, 99)

    RolePermission.__name__ = f"Require_{min_role.capitalize()}_Role"
    return RolePermission


IsOrganizationOwner = require_role("owner")
IsOrganizationAdmin = require_role("admin")
IsOrganizationManager = require_role("manager")
