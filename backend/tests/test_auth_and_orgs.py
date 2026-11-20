import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from apps.agents.models import AIAgent
from apps.common.tenancy import tenant_context
from apps.organizations.models import OrganizationMembership


@pytest.mark.django_db
def test_register_login_and_cross_org_isolation(api_client, create_org_with_owner):
    org_a, owner_a = create_org_with_owner("owner_a@acme.com", "Acme Realty")
    org_b, owner_b = create_org_with_owner("owner_b@zenith.com", "Zenith Homes")

    with tenant_context(org_b.id, actor_id=owner_b.id):
        agent_b = AIAgent.objects.create(organization=org_b, name="Zenith Secret Agent")

    # Authenticate as Owner A
    token_a = str(RefreshToken.for_user(owner_a).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_a}")

    # Attempt to pass Org B header -> blocked 403
    resp_forged = api_client.get("/api/v1/agents/", HTTP_X_ORGANIZATION_ID=str(org_b.id))
    assert resp_forged.status_code == 403

    # Access Org A -> allowed 200, does not contain Org B agent
    resp_ok = api_client.get("/api/v1/agents/", HTTP_X_ORGANIZATION_ID=str(org_a.id))
    assert resp_ok.status_code == 200
    assert all(item["id"] != str(agent_b.id) for item in resp_ok.data["results"])

    # Direct access to Agent B ID while authenticated in Org A -> 404
    resp_direct = api_client.get(f"/api/v1/agents/{agent_b.id}/", HTTP_X_ORGANIZATION_ID=str(org_a.id))
    assert resp_direct.status_code == 404


@pytest.mark.django_db
def test_rbac_member_cannot_create_agent_or_invite(api_client, create_org_with_owner):
    from apps.accounts.models import User

    org, owner = create_org_with_owner("owner@rbac.com", "RBAC Corp")
    member = User.objects.create_user(email="member@rbac.com", full_name="Member User", password="StrongPass123!")
    with tenant_context(org.id, actor_id=owner.id):
        OrganizationMembership.objects.create(
            organization=org, user=member, role=OrganizationMembership.Role.MEMBER, is_active=True
        )

    token = str(RefreshToken.for_user(member).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    resp_agent = api_client.post(
        "/api/v1/agents/",
        {"name": "Unauthorized Agent"},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert resp_agent.status_code == 403

    resp_invite = api_client.post(
        "/api/v1/organizations/invitations/",
        {"email": "new@rbac.com", "role": "admin"},
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert resp_invite.status_code == 403


@pytest.mark.django_db
def test_pakistan_edition_defaults_on_settings_and_plans():
    from django.conf import settings

    assert settings.TIME_ZONE == "Asia/Karachi"
    assert settings.CELERY_TIMEZONE == "Asia/Karachi"
    assert settings.DEFAULT_CURRENCY == "PKR"
    assert settings.DEFAULT_DATE_FORMAT == "DD-MM-YYYY"
    assert settings.DATE_FORMAT == "d-m-Y"
    assert settings.PLAN_QUOTAS["pro"]["currency"] == "PKR"
    assert settings.PLAN_QUOTAS["pro"]["price_monthly_pkr"] > 0
