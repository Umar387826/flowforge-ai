import hashlib
import hmac
import json
import time
import uuid
import httpx

MAX_TIMESTAMP_DRIFT_SECONDS = 300


def sign_webhook_payload(secret: str, timestamp: str, raw_body: bytes) -> str:
    signed_content = f"{timestamp}.".encode("utf-8") + raw_body
    digest = hmac.new(secret.encode("utf-8"), signed_content, hashlib.sha256).hexdigest()
    return f"v1={digest}"


def verify_webhook_signature(secret: str, timestamp_header: str, signature_header: str, raw_body: bytes) -> tuple[bool, str]:
    if not timestamp_header or not signature_header:
        return False, "Missing signature or timestamp header."
    try:
        ts = int(timestamp_header)
    except ValueError:
        return False, "Invalid timestamp format."

    now = int(time.time())
    if abs(now - ts) > MAX_TIMESTAMP_DRIFT_SECONDS:
        return False, "Webhook timestamp outside allowed 5-minute replay window."

    expected = sign_webhook_payload(secret, timestamp_header, raw_body)
    if not hmac.compare_digest(expected, signature_header.strip()):
        return False, "Invalid webhook HMAC signature."
    return True, ""


def send_signed_outbound_webhook(url: str, secret: str, event_type: str, payload: dict) -> tuple[int, str]:
    ts = str(int(time.time()))
    event_id = str(uuid.uuid4())
    body_bytes = json.dumps({"event_id": event_id, "event_type": event_type, "data": payload}).encode("utf-8")
    sig = sign_webhook_payload(secret, ts, body_bytes)
    headers = {
        "Content-Type": "application/json",
        "X-FlowForge-Timestamp": ts,
        "X-FlowForge-Event-ID": event_id,
        "X-FlowForge-Signature": sig,
    }
    with httpx.Client(timeout=15.0) as client:
        resp = client.post(url, content=body_bytes, headers=headers)
        return resp.status_code, resp.text
