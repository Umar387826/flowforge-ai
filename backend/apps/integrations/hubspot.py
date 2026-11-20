from datetime import timedelta
import secrets
from urllib.parse import urlencode
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
import httpx
from apps.integrations.models import IntegrationConnection, SyncLog

HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize"
HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token"
HUBSPOT_CONTACTS_URL = "https://api.hubapi.com/crm/v3/objects/contacts"


class HubSpotSyncError(Exception):
    pass


def build_hubspot_authorize_url(organization_id: str) -> str:
    if not settings.HUBSPOT_CLIENT_ID or not settings.HUBSPOT_CLIENT_SECRET:
        raise HubSpotSyncError("HubSpot OAuth credentials are not configured (HUBSPOT_CLIENT_ID/SECRET).")
    state = secrets.token_urlsafe(32)
    cache.set(f"hubspot_oauth_state:{state}", {"organization_id": str(organization_id)}, timeout=600)
    params = {
        "client_id": settings.HUBSPOT_CLIENT_ID,
        "redirect_uri": settings.HUBSPOT_REDIRECT_URI,
        "scope": "crm.objects.contacts.read crm.objects.contacts.write",
        "state": state,
    }
    return f"{HUBSPOT_AUTH_URL}?{urlencode(params)}"


def exchange_hubspot_code(organization, code: str, state: str) -> IntegrationConnection:
    cached = cache.get(f"hubspot_oauth_state:{state}")
    if not cached or str(cached.get("organization_id")) != str(organization.id):
        raise HubSpotSyncError("Invalid or expired HubSpot OAuth state.")
    cache.delete(f"hubspot_oauth_state:{state}")

    with httpx.Client(timeout=15.0) as client:
        resp = client.post(
            HUBSPOT_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "client_id": settings.HUBSPOT_CLIENT_ID,
                "client_secret": settings.HUBSPOT_CLIENT_SECRET,
                "redirect_uri": settings.HUBSPOT_REDIRECT_URI,
                "code": code,
            },
        )
        if resp.status_code >= 400:
            raise HubSpotSyncError(f"HubSpot token exchange failed: {resp.text}")
        data = resp.json()

    conn, _ = IntegrationConnection.objects.update_or_create(
        organization=organization,
        provider=IntegrationConnection.Provider.HUBSPOT,
        defaults={
            "status": IntegrationConnection.Status.CONNECTED,
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", ""),
            "token_expires_at": timezone.now() + timedelta(seconds=int(data.get("expires_in", 1800))),
            "last_error": "",
        },
    )
    return conn


def _get_hubspot_token(organization) -> str:
    conn = IntegrationConnection.objects.filter(
        organization=organization,
        provider=IntegrationConnection.Provider.HUBSPOT,
        status=IntegrationConnection.Status.CONNECTED,
    ).first()
    if conn and conn.access_token:
        if conn.token_expires_at and conn.token_expires_at <= timezone.now() + timedelta(minutes=2):
            if conn.refresh_token and settings.HUBSPOT_CLIENT_ID:
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(
                        HUBSPOT_TOKEN_URL,
                        data={
                            "grant_type": "refresh_token",
                            "client_id": settings.HUBSPOT_CLIENT_ID,
                            "client_secret": settings.HUBSPOT_CLIENT_SECRET,
                            "refresh_token": conn.refresh_token,
                        },
                    )
                    if resp.status_code < 400:
                        d = resp.json()
                        conn.access_token = d["access_token"]
                        conn.token_expires_at = timezone.now() + timedelta(seconds=int(d.get("expires_in", 1800)))
                        conn.save(update_fields=["access_token", "token_expires_at", "updated_at"])
        return conn.access_token

    if settings.HUBSPOT_PRIVATE_APP_TOKEN:
        return settings.HUBSPOT_PRIVATE_APP_TOKEN

    raise HubSpotSyncError(
        "HubSpot CRM is not connected for this organization and no HUBSPOT_PRIVATE_APP_TOKEN is configured."
    )


def sync_lead_to_hubspot(organization, lead) -> dict:
    """
    Create or update a HubSpot Contact via HubSpot CRM v3 API.
    Never returns a fake success response when credentials are missing or API calls fail.
    """
    token = _get_hubspot_token(organization)

    name_parts = (lead.full_name or "").strip().split(" ", 1)
    firstname = name_parts[0] if name_parts and name_parts[0] else ""
    lastname = name_parts[1] if len(name_parts) > 1 else ""

    properties = {
        "email": lead.email,
        "firstname": firstname,
        "lastname": lastname,
        "phone": lead.phone or "",
        "company": lead.company or "",
    }

    conn = IntegrationConnection.objects.filter(
        organization=organization, provider=IntegrationConnection.Provider.HUBSPOT
    ).first()
    if conn and conn.field_mapping:
        for src_key, hs_prop in conn.field_mapping.items():
            if src_key in (lead.preferences or {}):
                properties[hs_prop] = str(lead.preferences[src_key])

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    with httpx.Client(timeout=20.0) as client:
        if lead.crm_external_id:
            resp = client.patch(
                f"{HUBSPOT_CONTACTS_URL}/{lead.crm_external_id}",
                headers=headers,
                json={"properties": properties},
            )
        else:
            resp = client.post(
                HUBSPOT_CONTACTS_URL,
                headers=headers,
                json={"properties": properties},
            )
            # Handle 409 Conflict (contact with email already exists in HubSpot) by searching & updating
            if resp.status_code == 409:
                search_resp = client.post(
                    f"{HUBSPOT_CONTACTS_URL}/search",
                    headers=headers,
                    json={
                        "filterGroups": [
                            {"filters": [{"propertyName": "email", "operator": "EQ", "value": lead.email}]}
                        ]
                    },
                )
                if search_resp.status_code < 400 and search_resp.json().get("results"):
                    existing_id = search_resp.json()["results"][0]["id"]
                    resp = client.patch(
                        f"{HUBSPOT_CONTACTS_URL}/{existing_id}",
                        headers=headers,
                        json={"properties": properties},
                    )

        if resp.status_code >= 400:
            SyncLog.objects.create(
                organization=organization,
                provider="hubspot",
                resource_type="Lead",
                resource_id=str(lead.id),
                status="failed",
                request_payload=properties,
                error_message=resp.text,
            )
            raise HubSpotSyncError(f"HubSpot API error ({resp.status_code}): {resp.text}")

        data = resp.json()
        contact_id = data.get("id", lead.crm_external_id)

    lead.crm_external_id = contact_id
    lead.status = lead.Status.SYNCED
    lead.save(update_fields=["crm_external_id", "status", "updated_at"])

    SyncLog.objects.create(
        organization=organization,
        provider="hubspot",
        resource_type="Lead",
        resource_id=str(lead.id),
        external_id=contact_id,
        status="success",
        request_payload=properties,
        response_payload=data,
    )
    return {"contact_id": contact_id, "status": "synced"}
