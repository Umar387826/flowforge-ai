import json
import anthropic
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from apps.leads.models import Lead


LEAD_QUALIFICATION_TOOL = {
    "name": "submit_lead_qualification",
    "description": "Score and qualify a captured lead based on intent, budget, timeline, and fit.",
    "input_schema": {
        "type": "object",
        "properties": {
            "score": {"type": "integer", "minimum": 0, "maximum": 100},
            "qualified": {"type": "boolean"},
            "reason": {"type": "string"},
        },
        "required": ["score", "qualified", "reason"],
    },
}


def qualify_lead_with_ai(lead: Lead) -> Lead:
    """
    Qualify a lead using the configured local Ollama model.
    The lead is only updated after valid structured tool output is received.
    """
    from apps.agents.services import get_llm_provider

    lead_summary = {
        "full_name": lead.full_name,
        "email": lead.email,
        "phone": lead.phone,
        "company": lead.company,
        "preferences": lead.preferences,
    }

    try:
        provider = get_llm_provider("ollama")
        response = provider.generate(
            system_prompt=(
                "You are a business lead qualification assistant. "
                "Evaluate the lead using only the supplied information. "
                "Do not invent missing details. "
                "Score from 0 to 100 based on customer intent, business fit, "
                "purchase requirements, budget and timeline when available. "
                "Set qualified=true if and only if score is 60 or higher. "
                "Call submit_lead_qualification with the structured result."
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Evaluate this inbound lead and submit its qualification: "
                        + json.dumps(lead_summary, ensure_ascii=False)
                    ),
                }
            ],
            model=getattr(settings, "OLLAMA_CHAT_MODEL", "qwen2.5:3b"),
            temperature=0.0,
            max_tokens=300,
            tools=[LEAD_QUALIFICATION_TOOL],
        )
    except Exception as exc:
        raise RuntimeError(f"Ollama lead qualification failed: {exc}") from exc

    for tool_call in response.tool_calls or []:
        if not isinstance(tool_call, dict):
            continue
        if tool_call.get("name") != "submit_lead_qualification":
            continue

        data = tool_call.get("input")
        if not isinstance(data, dict):
            raise RuntimeError("Ollama returned invalid qualification data.")

        score = data.get("score")
        qualified = data.get("qualified")
        reason = data.get("reason")

        if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= 100:
            raise RuntimeError("Ollama returned an invalid qualification score.")
        if not isinstance(qualified, bool):
            raise RuntimeError("Ollama returned an invalid qualified flag.")
        if qualified != (score >= 60):
            raise RuntimeError("Ollama returned inconsistent qualification data.")
        if not isinstance(reason, str) or not reason.strip():
            raise RuntimeError("Ollama did not provide a qualification reason.")

        lead.qualification_score = score
        lead.qualification_reason = reason.strip()[:2000]
        lead.status = (
            Lead.Status.QUALIFIED if score >= 60 else Lead.Status.DISQUALIFIED
        )
        lead.save(
            update_fields=[
                "qualification_score",
                "qualification_reason",
                "status",
                "updated_at",
            ]
        )
        return lead

    raise RuntimeError(
        "Ollama did not return structured qualification tool output."
    )


def capture_lead_from_tool(*, organization, tool_input, source_conversation=None):
    """
    Safely create/update a tenant-scoped lead from an AI tool call.
    Returns the Lead, or None when the supplied email is invalid/missing.
    """
    if not isinstance(tool_input, dict):
        return None

    email = str(tool_input.get("email") or "").strip().lower()
    if not email:
        return None

    try:
        validate_email(email)
    except ValidationError:
        return None

    preferences = tool_input.get("preferences")
    if not isinstance(preferences, dict):
        preferences = {}

    def clean_text(key, limit):
        value = tool_input.get(key) or ""
        if not isinstance(value, str):
            value = str(value)
        return value.strip()[:limit]

    defaults = {
        "full_name": clean_text("full_name", 150),
        "phone": clean_text("phone", 50),
        "company": clean_text("company", 150),
        "preferences": preferences,
    }

    # Do not erase an existing conversation link from a Test Console update.
    if source_conversation is not None:
        defaults["source_conversation"] = source_conversation

    lead, _ = Lead.objects.update_or_create(
        organization=organization,
        email=email,
        defaults=defaults,
    )

    organization_id = str(organization.id)
    payload = {
        "lead_id": str(lead.id),
        "email": lead.email,
        "full_name": lead.full_name,
        "preferences": lead.preferences,
    }

    def dispatch():
        from apps.workflows.engine import dispatch_workflows_for_event

        dispatch_workflows_for_event(
            organization_id=organization_id,
            trigger_type="lead_captured",
            payload=payload,
        )

    transaction.on_commit(dispatch)
    return lead
