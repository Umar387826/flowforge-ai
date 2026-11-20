from datetime import timedelta
import secrets
from urllib.parse import urlencode
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
import httpx
from apps.integrations.models import IntegrationConnection

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


class GoogleOAuthError(Exception):
    pass


def build_google_authorize_url(organization_id: str, user_id: str) -> str:
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        raise GoogleOAuthError("Google OAuth credentials are not configured (GOOGLE_OAUTH_CLIENT_ID/SECRET).")

    state = secrets.token_urlsafe(32)
    cache.set(
        f"google_oauth_state:{state}",
        {"organization_id": str(organization_id), "user_id": str(user_id)},
        timeout=600,
    )
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/gmail.send",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def validate_google_oauth_state(state: str, organization_id: str) -> bool:
    data = cache.get(f"google_oauth_state:{state}")
    if not data:
        return False
    cache.delete(f"google_oauth_state:{state}")
    return str(data.get("organization_id")) == str(organization_id)


def exchange_google_code(organization, code: str, state: str) -> IntegrationConnection:
    if not validate_google_oauth_state(state, str(organization.id)):
        raise GoogleOAuthError("Invalid or expired OAuth state parameter.")
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        raise GoogleOAuthError("Google OAuth credentials are not configured.")

    with httpx.Client(timeout=15.0) as client:
        token_resp = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code >= 400:
            raise GoogleOAuthError(f"Google token exchange failed: {token_resp.text}")
        token_data = token_resp.json()

        access_token = token_data["access_token"]
        info_resp = client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        account_email = info_resp.json().get("email", "") if info_resp.status_code == 200 else ""

    expires_in = int(token_data.get("expires_in", 3600))
    conn, _ = IntegrationConnection.objects.update_or_create(
        organization=organization,
        provider=IntegrationConnection.Provider.GOOGLE_OAUTH,
        defaults={
            "status": IntegrationConnection.Status.CONNECTED,
            "access_token": access_token,
            "refresh_token": token_data.get("refresh_token", ""),
            "token_expires_at": timezone.now() + timedelta(seconds=expires_in),
            "scopes": token_data.get("scope", "").split(),
            "account_email": account_email,
            "last_error": "",
        },
    )
    return conn


def refresh_google_token(conn: IntegrationConnection) -> IntegrationConnection:
    if not conn.refresh_token:
        raise GoogleOAuthError("No Google refresh token available.")
    with httpx.Client(timeout=15.0) as client:
        resp = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "refresh_token": conn.refresh_token,
                "grant_type": "refresh_token",
            },
        )
        if resp.status_code >= 400:
            conn.status = IntegrationConnection.Status.ERROR
            conn.last_error = resp.text
            conn.save(update_fields=["status", "last_error", "updated_at"])
            raise GoogleOAuthError(f"Google token refresh failed: {resp.text}")
        data = resp.json()

    conn.access_token = data["access_token"]
    conn.token_expires_at = timezone.now() + timedelta(seconds=int(data.get("expires_in", 3600)))
    conn.status = IntegrationConnection.Status.CONNECTED
    conn.last_error = ""
    conn.save(update_fields=["access_token", "token_expires_at", "status", "last_error", "updated_at"])
    return conn


def revoke_google_connection(conn: IntegrationConnection) -> None:
    token = conn.access_token or conn.refresh_token
    if token:
        try:
            with httpx.Client(timeout=10.0) as client:
                client.post(GOOGLE_REVOKE_URL, params={"token": token})
        except Exception:
            pass
    conn.status = IntegrationConnection.Status.DISCONNECTED
    conn.access_token = ""
    conn.refresh_token = ""
    conn.save(update_fields=["status", "access_token", "refresh_token", "updated_at"])
