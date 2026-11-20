import json
import anthropic
from django.conf import settings
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
    Qualify a lead using Anthropic structured tool output.
    Raises RuntimeError if ANTHROPIC_API_KEY is missing (never fakes AI output).
    """
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured for AI lead qualification.")

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=30.0)
    lead_summary = {
        "full_name": lead.full_name,
        "email": lead.email,
        "phone": lead.phone,
        "company": lead.company,
        "preferences": lead.preferences,
    }
    resp = client.messages.create(
        model=settings.ANTHROPIC_DEFAULT_MODEL,
        max_tokens=300,
        temperature=0.0,
        tools=[LEAD_QUALIFICATION_TOOL],
        tool_choice={"type": "tool", "name": "submit_lead_qualification"},
        messages=[
            {
                "role": "user",
                "content": (
                    "Evaluate this inbound lead and call submit_lead_qualification with a 0-100 score, "
                    f"boolean qualified flag (true if score >= 60), and concise reason:\n{json.dumps(lead_summary)}"
                ),
            }
        ],
    )

    for block in resp.content:
        if block.type == "tool_use" and block.name == "submit_lead_qualification":
            data = block.input
            lead.qualification_score = int(data.get("score", 0))
            lead.qualification_reason = str(data.get("reason", ""))
            lead.status = Lead.Status.QUALIFIED if data.get("qualified") else Lead.Status.DISQUALIFIED
            lead.save(update_fields=["qualification_score", "qualification_reason", "status", "updated_at"])
            return lead

    raise RuntimeError("LLM did not return structured qualification tool output.")
