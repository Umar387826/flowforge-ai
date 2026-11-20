from datetime import datetime, timezone as dt_timezone
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework import exceptions
import stripe
from apps.billing.models import InvoiceHistory, StripeWebhookEvent, Subscription, UsageRecord
from apps.common.tenancy import resolve_subscription_org_id, tenant_context


class QuotaExceededError(exceptions.APIException):
    status_code = 402
    default_detail = "Organization plan quota exceeded. Please upgrade your subscription."
    default_code = "quota_exceeded"


def current_period_ym() -> str:
    return timezone.now().strftime("%Y-%m")


def ensure_free_subscription(organization) -> Subscription:
    sub, _ = Subscription.objects.get_or_create(
        organization=organization,
        defaults={
            "plan_tier": Subscription.PlanTier.FREE,
            "status": Subscription.Status.ACTIVE,
            "current_period_start": timezone.now(),
        },
    )
    return sub


def get_org_plan_limits(organization) -> dict:
    sub = ensure_free_subscription(organization)
    tier = sub.plan_tier
    if sub.status in (Subscription.Status.CANCELED, Subscription.Status.PAST_DUE):
        tier = Subscription.PlanTier.FREE
    return settings.PLAN_QUOTAS.get(tier, settings.PLAN_QUOTAS["free"])


def get_usage_summary(organization) -> dict:
    ym = current_period_ym()
    records = {
        r["metric"]: r["quantity"]
        for r in UsageRecord.objects.filter(organization=organization, period_ym=ym).values("metric", "quantity")
    }
    from apps.agents.models import AIAgent
    from apps.documents.models import Document

    agent_count = AIAgent.objects.filter(organization=organization).count()
    doc_stats = Document.objects.filter(organization=organization).aggregate(
        total_bytes=Sum("file_size"),
    )
    storage_bytes = doc_stats["total_bytes"] or 0
    doc_count = Document.objects.filter(organization=organization).count()

    return {
        "period": ym,
        "ai_requests": records.get(UsageRecord.Metric.AI_REQUESTS, 0),
        "tokens": records.get(UsageRecord.Metric.TOKENS, 0),
        "conversations": records.get(UsageRecord.Metric.CONVERSATIONS, 0),
        "workflow_executions": records.get(UsageRecord.Metric.WORKFLOW_EXECUTIONS, 0),
        "api_calls": records.get(UsageRecord.Metric.API_CALLS, 0),
        "agents": agent_count,
        "documents": doc_count,
        "storage_mb": round(storage_bytes / (1024 * 1024), 2),
    }


def enforce_quota(organization, metric: str, increment: int = 1) -> None:
    """
    Strictly enforce plan limits on the backend before allowing resource creation or AI/workflow runs.
    """
    limits = get_org_plan_limits(organization)
    usage = get_usage_summary(organization)

    limit_map = {
        UsageRecord.Metric.AI_REQUESTS: ("ai_requests", "max_ai_requests_monthly", "Monthly AI request quota exceeded."),
        UsageRecord.Metric.TOKENS: ("tokens", "max_tokens_monthly", "Monthly token quota exceeded."),
        UsageRecord.Metric.WORKFLOW_EXECUTIONS: (
            "workflow_executions",
            "max_workflow_executions_monthly",
            "Monthly workflow execution quota exceeded.",
        ),
        "agents": ("agents", "max_agents", "Maximum AI agents limit reached for your plan."),
        "documents": ("documents", "max_documents", "Maximum document limit reached for your plan."),
        "storage_mb": ("storage_mb", "max_storage_mb", "Document storage quota exceeded."),
    }

    if metric in limit_map:
        usage_key, limit_key, message = limit_map[metric]
        current_val = usage.get(usage_key, 0)
        max_val = limits.get(limit_key, 0)
        if current_val + increment > max_val:
            raise QuotaExceededError(detail=f"{message} (Current: {current_val}, Limit: {max_val})")


def record_usage(organization, metric: str, quantity: int = 1) -> None:
    if quantity <= 0:
        return
    ym = current_period_ym()
    record, created = UsageRecord.objects.get_or_create(
        organization=organization,
        period_ym=ym,
        metric=metric,
        defaults={"quantity": quantity},
    )
    if not created:
        UsageRecord.objects.filter(pk=record.pk).update(quantity=F("quantity") + quantity)


def create_checkout_session(organization, plan_tier: str, user_email: str) -> dict:
    if not settings.STRIPE_SECRET_KEY:
        raise exceptions.ValidationError(
            {"detail": "Stripe is awaiting credentials (STRIPE_SECRET_KEY not configured)."}
        )

    price_map = {
        Subscription.PlanTier.PRO: settings.STRIPE_PRICE_PRO_MONTHLY,
        Subscription.PlanTier.BUSINESS: settings.STRIPE_PRICE_BUSINESS_MONTHLY,
    }
    price_id = price_map.get(plan_tier)
    if not price_id:
        raise exceptions.ValidationError({"plan_tier": f"Stripe price ID for '{plan_tier}' is not configured."})

    stripe.api_key = settings.STRIPE_SECRET_KEY
    sub = ensure_free_subscription(organization)

    customer_id = sub.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(
            email=user_email,
            name=organization.name,
            metadata={"organization_id": str(organization.id)},
        )
        customer_id = customer.id
        sub.stripe_customer_id = customer_id
        sub.save(update_fields=["stripe_customer_id", "updated_at"])

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_APP_URL}/billing?checkout=success",
        cancel_url=f"{settings.FRONTEND_APP_URL}/billing?checkout=canceled",
        metadata={"organization_id": str(organization.id), "plan_tier": plan_tier},
    )
    return {"checkout_url": session.url, "session_id": session.id}


def create_billing_portal_session(organization) -> dict:
    if not settings.STRIPE_SECRET_KEY:
        raise exceptions.ValidationError(
            {"detail": "Stripe is awaiting credentials (STRIPE_SECRET_KEY not configured)."}
        )
    sub = ensure_free_subscription(organization)
    if not sub.stripe_customer_id:
        raise exceptions.ValidationError({"detail": "No Stripe customer exists for this organization yet."})
    stripe.api_key = settings.STRIPE_SECRET_KEY
    portal = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{settings.FRONTEND_APP_URL}/billing",
    )
    return {"portal_url": portal.url}


def process_stripe_webhook(payload_bytes: bytes, sig_header: str) -> dict:
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise exceptions.ValidationError({"detail": "STRIPE_WEBHOOK_SECRET is not configured."})

    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        event = stripe.Webhook.construct_event(
            payload=payload_bytes,
            sig_header=sig_header,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )
    except stripe.error.SignatureVerificationError as exc:
        raise exceptions.PermissionDenied("Invalid Stripe webhook signature.") from exc
    except Exception as exc:
        raise exceptions.ValidationError({"detail": f"Invalid webhook payload: {exc}"}) from exc

    event_id = event["id"]
    event_type = event["type"]

    # Idempotency guard: prevent duplicate processing
    try:
        with transaction.atomic():
            StripeWebhookEvent.objects.create(
                stripe_event_id=event_id,
                event_type=event_type,
                payload=event,
            )
    except IntegrityError:
        return {"status": "duplicate_ignored", "event_id": event_id}

    data_obj = event["data"]["object"]
    if event_type == "checkout.session.completed":
        meta = data_obj.get("metadata") or {}
        org_id = meta.get("organization_id")
        plan_tier = meta.get("plan_tier", Subscription.PlanTier.PRO)
        if org_id:
            with tenant_context(org_id):
                Subscription.objects.filter(organization_id=org_id).update(
                    plan_tier=plan_tier,
                    status=Subscription.Status.ACTIVE,
                    stripe_customer_id=data_obj.get("customer", ""),
                    stripe_subscription_id=data_obj.get("subscription", ""),
                )

    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        stripe_sub_id = data_obj.get("id", "")
        customer_id = data_obj.get("customer", "")
        org_id = resolve_subscription_org_id(stripe_sub_id=stripe_sub_id, stripe_customer_id=customer_id)
        if org_id:
            with tenant_context(org_id):
                sub_row = (
                    Subscription.objects.filter(stripe_subscription_id=stripe_sub_id).first()
                    or Subscription.objects.filter(stripe_customer_id=customer_id).first()
                )
                if sub_row:
                    new_status = data_obj.get("status", Subscription.Status.ACTIVE)
                    if event_type == "customer.subscription.deleted":
                        sub_row.plan_tier = Subscription.PlanTier.FREE
                        sub_row.status = Subscription.Status.CANCELED
                    else:
                        sub_row.status = new_status
                        sub_row.cancel_at_period_end = bool(data_obj.get("cancel_at_period_end", False))
                        if data_obj.get("current_period_start"):
                            sub_row.current_period_start = datetime.fromtimestamp(
                                data_obj["current_period_start"], tz=dt_timezone.utc
                            )
                        if data_obj.get("current_period_end"):
                            sub_row.current_period_end = datetime.fromtimestamp(
                                data_obj["current_period_end"], tz=dt_timezone.utc
                            )
                    sub_row.save()

    elif event_type == "invoice.paid":
        customer_id = data_obj.get("customer", "")
        org_id = resolve_subscription_org_id(stripe_customer_id=customer_id)
        if org_id:
            with tenant_context(org_id):
                sub_row = Subscription.objects.filter(stripe_customer_id=customer_id).first()
                if sub_row:
                    InvoiceHistory.objects.update_or_create(
                        stripe_invoice_id=data_obj["id"],
                        defaults={
                            "organization": sub_row.organization,
                            "amount_paid_cents": data_obj.get("amount_paid", 0),
                            "currency": data_obj.get("currency", "usd"),
                            "status": data_obj.get("status", "paid"),
                            "invoice_pdf_url": data_obj.get("invoice_pdf", "") or "",
                        },
                    )

    return {"status": "processed", "event_id": event_id, "event_type": event_type}
