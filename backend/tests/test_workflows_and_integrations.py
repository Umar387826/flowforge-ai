import json
import time
from unittest.mock import patch
import pytest
from apps.common.tenancy import tenant_context
from apps.integrations.models import WebhookEndpoint, WebhookEvent
from apps.integrations.webhooks import sign_webhook_payload, verify_webhook_signature
from apps.leads.models import Lead
from apps.workflows.engine import evaluate_conditions, run_workflow_execution
from apps.workflows.models import Workflow, WorkflowExecution


def test_condition_evaluator_and_or_logic():
    cond_and = {
        "operator": "AND",
        "rules": [
            {"field": "qualification_score", "op": "gte", "value": 70},
            {"field": "preferences.city", "op": "contains", "value": "austin"},
        ],
    }
    assert evaluate_conditions(cond_and, {"qualification_score": 85, "preferences": {"city": "Austin, TX"}}) is True
    assert evaluate_conditions(cond_and, {"qualification_score": 50, "preferences": {"city": "Austin, TX"}}) is False


@pytest.mark.django_db
def test_webhook_signature_replay_protection(api_client, create_org_with_owner):
    org, _ = create_org_with_owner("wh@test.com", "Webhook Org")
    with tenant_context(org.id):
        ep = WebhookEndpoint.objects.create(organization=org, name="Inbound Lead Hook", direction="inbound")

    body = json.dumps({"event_type": "lead.external", "email": "buyer@example.com"}).encode("utf-8")
    ts = str(int(time.time()))
    sig = sign_webhook_payload(ep.signing_secret, ts, body)

    # Valid signature passes
    resp1 = api_client.post(
        f"/api/v1/integrations/webhooks/inbound/{ep.id}/",
        data=body,
        content_type="application/json",
        HTTP_X_FLOWFORGE_TIMESTAMP=ts,
        HTTP_X_FLOWFORGE_SIGNATURE=sig,
        HTTP_X_FLOWFORGE_EVENT_ID="evt_unique_1",
    )
    assert resp1.status_code == 202

    # Replay with same event_id rejected (409)
    resp_replay = api_client.post(
        f"/api/v1/integrations/webhooks/inbound/{ep.id}/",
        data=body,
        content_type="application/json",
        HTTP_X_FLOWFORGE_TIMESTAMP=ts,
        HTTP_X_FLOWFORGE_SIGNATURE=sig,
        HTTP_X_FLOWFORGE_EVENT_ID="evt_unique_1",
    )
    assert resp_replay.status_code == 409

    # Expired timestamp rejected
    old_ts = str(int(time.time()) - 900)
    old_sig = sign_webhook_payload(ep.signing_secret, old_ts, body)
    valid, _ = verify_webhook_signature(ep.signing_secret, old_ts, old_sig, body)
    assert valid is False


@pytest.mark.django_db
def test_workflow_executes_ai_qualification_and_hubspot_sync(create_org_with_owner):
    org, _ = create_org_with_owner("wf@test.com", "Workflow Org")
    with tenant_context(org.id):
        lead = Lead.objects.create(organization=org, email="vip@buyer.com", full_name="VIP Buyer", preferences={"budget": "$1.5M"})
        wf = Workflow.objects.create(
            organization=org,
            name="Qualify and Sync to HubSpot",
            trigger_type=Workflow.TriggerType.LEAD_CAPTURED,
            conditions={"operator": "AND", "rules": [{"field": "email", "op": "exists"}]},
            actions=[
                {"type": "ai_qualify_lead", "config": {}},
                {"type": "hubspot_create_contact", "config": {"min_score": 60}},
                {"type": "send_notification", "config": {"title": "Lead Synced"}},
            ],
        )
        exec_obj = WorkflowExecution.objects.create(
            organization=org,
            workflow=wf,
            idempotency_key="wf_test_1",
            trigger_payload={"lead_id": str(lead.id), "email": lead.email},
        )

    def _mock_qualify(lead_obj):
        lead_obj.qualification_score = 88
        lead_obj.status = Lead.Status.QUALIFIED
        lead_obj.save()
        return lead_obj

    with patch("apps.workflows.engine.qualify_lead_with_ai", side_effect=_mock_qualify), patch(
        "apps.workflows.engine.sync_lead_to_hubspot", return_value={"contact_id": "hs_999", "status": "synced"}
    ):
        res = run_workflow_execution(str(exec_obj.id), str(org.id))
        assert res["status"] == "succeeded"

    with tenant_context(org.id):
        exec_obj.refresh_from_db()
        assert exec_obj.status == WorkflowExecution.Status.SUCCEEDED
        assert len(exec_obj.step_logs) == 4
