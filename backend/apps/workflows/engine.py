import hashlib
import json
from django.utils import timezone
from apps.billing.models import UsageRecord
from apps.billing.services import enforce_quota, record_usage
from apps.common.tenancy import tenant_context
from apps.integrations.hubspot import sync_lead_to_hubspot
from apps.integrations.webhooks import send_signed_outbound_webhook
from apps.leads.models import Lead
from apps.leads.services import qualify_lead_with_ai
from apps.notifications.models import Notification
from apps.workflows.models import Workflow, WorkflowExecution


def _get_nested(data: dict, path: str):
    cur = data
    for key in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(key)
        else:
            return None
    return cur


def _eval_rule(rule: dict, payload: dict) -> bool:
    field_val = _get_nested(payload, rule.get("field", ""))
    op = rule.get("op", "eq")
    target = rule.get("value")

    if op == "eq":
        return field_val == target
    if op == "neq":
        return field_val != target
    if op == "exists":
        return field_val is not None and field_val != ""
    if op == "contains":
        return target is not None and str(target).lower() in str(field_val or "").lower()
    if op in ("gt", "gte", "lt", "lte"):
        try:
            a, b = float(field_val), float(target)
        except (TypeError, ValueError):
            return False
        if op == "gt":
            return a > b
        if op == "gte":
            return a >= b
        if op == "lt":
            return a < b
        if op == "lte":
            return a <= b
    return False


def evaluate_conditions(conditions: dict, payload: dict) -> bool:
    rules = (conditions or {}).get("rules") or []
    if not rules:
        return True
    operator = str((conditions or {}).get("operator", "AND")).upper()
    results = [_eval_rule(r, payload) for r in rules]
    return any(results) if operator == "OR" else all(results)


def dispatch_workflows_for_event(organization_id: str, trigger_type: str, payload: dict, idempotency_seed: str | None = None):
    from apps.workflows.tasks import execute_workflow_task

    with tenant_context(organization_id):
        workflows = Workflow.objects.filter(
            organization_id=organization_id,
            trigger_type=trigger_type,
            is_active=True,
        )
        for wf in workflows:
            seed = idempotency_seed or json.dumps({"wf": str(wf.id), "payload": payload}, sort_keys=True, default=str)
            idem_key = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:48]
            execution, created = WorkflowExecution.objects.get_or_create(
                organization_id=wf.organization_id,
                workflow=wf,
                idempotency_key=idem_key,
                defaults={"trigger_payload": payload, "status": WorkflowExecution.Status.PENDING},
            )
            if created:
                execute_workflow_task.delay(str(execution.id), str(organization_id))


def run_workflow_execution(execution_id: str, organization_id: str) -> dict:
    with tenant_context(organization_id):
        execution = WorkflowExecution.objects.select_related("workflow", "organization").filter(id=execution_id).first()
        if not execution:
            return {"status": "rejected_tenant_mismatch"}
        if execution.status == WorkflowExecution.Status.SUCCEEDED:
            return {"status": "already_succeeded"}

        wf = execution.workflow
        enforce_quota(execution.organization, UsageRecord.Metric.WORKFLOW_EXECUTIONS, 1)

        execution.status = WorkflowExecution.Status.RUNNING
        execution.save(update_fields=["status", "updated_at"])

        payload = dict(execution.trigger_payload or {})
        # Hydrate latest lead attributes if lead_id is present
        lead = None
        if payload.get("lead_id"):
            lead = Lead.objects.filter(id=payload["lead_id"], organization_id=organization_id).first()
            if lead:
                payload.update(
                    {
                        "qualification_score": lead.qualification_score,
                        "lead_status": lead.status,
                        "email": lead.email,
                    }
                )

        if not evaluate_conditions(wf.conditions, payload):
            execution.status = WorkflowExecution.Status.SKIPPED
            execution.step_logs = [{"step": "conditions", "passed": False}]
            execution.completed_at = timezone.now()
            execution.save(update_fields=["status", "step_logs", "completed_at", "updated_at"])
            return {"status": "skipped"}

        logs = [{"step": "conditions", "passed": True}]
        try:
            for idx, action_def in enumerate(wf.actions or []):
                action_type = action_def.get("type")
                cfg = action_def.get("config") or {}

                if action_type == "ai_qualify_lead":
                    if not lead:
                        raise ValueError("ai_qualify_lead requires lead_id in trigger payload.")
                    lead = qualify_lead_with_ai(lead)
                    payload["qualification_score"] = lead.qualification_score
                    payload["lead_status"] = lead.status
                    logs.append({"step": idx, "action": action_type, "score": lead.qualification_score, "status": lead.status})

                elif action_type in ("hubspot_create_contact", "hubspot_update_contact"):
                    if not lead:
                        raise ValueError("HubSpot sync requires lead_id in trigger payload.")
                    min_score = int(cfg.get("min_score", 0))
                    if lead.qualification_score < min_score:
                        logs.append({"step": idx, "action": action_type, "skipped": f"score {lead.qualification_score} < {min_score}"})
                    else:
                        hs_res = sync_lead_to_hubspot(execution.organization, lead)
                        logs.append({"step": idx, "action": action_type, "result": hs_res})

                elif action_type == "send_webhook":
                    url = cfg.get("url")
                    secret = cfg.get("secret", "")
                    if not url:
                        raise ValueError("send_webhook requires target url.")
                    code, body = send_signed_outbound_webhook(url, secret, wf.trigger_type, payload)
                    if code >= 400:
                        raise RuntimeError(f"Outbound webhook failed with HTTP {code}: {body[:200]}")
                    logs.append({"step": idx, "action": action_type, "status_code": code})

                elif action_type == "send_notification":
                    Notification.objects.create(
                        organization=execution.organization,
                        title=cfg.get("title", f"Workflow: {wf.name}"),
                        message=cfg.get("message", f"Workflow '{wf.name}' executed for {payload.get('email', 'event')}."),
                        level=cfg.get("level", Notification.Level.INFO),
                        metadata=payload,
                    )
                    logs.append({"step": idx, "action": action_type, "notified": True})

                elif action_type == "update_record":
                    if lead and cfg.get("status"):
                        lead.status = cfg["status"]
                        lead.save(update_fields=["status", "updated_at"])
                    logs.append({"step": idx, "action": action_type, "updated": True})

            record_usage(execution.organization, UsageRecord.Metric.WORKFLOW_EXECUTIONS, 1)
            execution.status = WorkflowExecution.Status.SUCCEEDED
            execution.step_logs = logs
            execution.error_message = ""
            execution.completed_at = timezone.now()
            execution.save(update_fields=["status", "step_logs", "error_message", "completed_at", "updated_at"])
            return {"status": "succeeded", "logs": logs}
        except Exception as exc:
            execution.status = WorkflowExecution.Status.FAILED
            execution.step_logs = logs
            execution.error_message = str(exc)
            execution.save(update_fields=["status", "step_logs", "error_message", "updated_at"])
            raise
