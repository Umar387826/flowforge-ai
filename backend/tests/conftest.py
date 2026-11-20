import pytest
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.billing.services import ensure_free_subscription
from apps.common.tenancy import tenant_context
from apps.organizations.models import Organization, OrganizationMembership


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def create_org_with_owner(db):
    def _factory(email: str, org_name: str, password: str = "StrongPass123!"):
        user = User.objects.create_user(email=email, full_name=email.split("@")[0], password=password)
        slug = org_name.lower().replace(" ", "-")
        org = Organization.objects.create(
            name=org_name,
            slug=slug,
            created_by=user,
            settings={"currency": "PKR", "timezone": "Asia/Karachi", "date_format": "DD-MM-YYYY"},
        )
        with tenant_context(org.id, actor_id=user.id):
            OrganizationMembership.objects.create(
                organization=org, user=user, role=OrganizationMembership.Role.OWNER, is_active=True
            )
            ensure_free_subscription(org)
        return org, user

    return _factory
