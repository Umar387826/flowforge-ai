import json
from unittest.mock import patch
import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from apps.billing.models import StripeWebhookEvent, Subscription, UsageRecord
from apps.billing.services import QuotaExceededError, enforce_quota, process_stripe_webhook, record_usage
from apps.common.tenancy import tenant_context


@pytest.mark.django_db
def test_free_quota_enforcement_and_stripe_upgrade_idempotency(api_client, create_org_with_owner, settings):
    org, owner = create_org_with_owner("billing@test.com", "Billing Org")
    settings.STRIPE_WEBHOOK_SECRET = "whsec_test_secret"
    settings.STRIPE_SECRET_KEY = "sk_test_mock"

    with tenant_context(org.id, actor_id=owner.id):
        # Consume entire Free AI request quota (100)
        record_usage(org, UsageRecord.Metric.AI_REQUESTS, 100)
        with pytest.raises(QuotaExceededError):
            enforce_quota(org, UsageRecord.Metric.AI_REQUESTS, 1)

    # Mock Stripe Webhook verification for checkout.session.completed -> upgrade to Pro
    stripe_event = {
        "id": "evt_stripe_upgrade_1",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_123",
                "subscription": "sub_123",
                "metadata": {"organization_id": str(org.id), "plan_tier": "pro"},
            }
        },
    }

    with patch("stripe.Webhook.construct_event", return_value=stripe_event):
        res1 = process_stripe_webhook(json.dumps(stripe_event).encode(), "t=1,v1=sig")
        assert res1["status"] == "processed"

        # Duplicate webhook event must be ignored idempotently
        res2 = process_stripe_webhook(json.dumps(stripe_event).encode(), "t=1,v1=sig")
        assert res2["status"] == "duplicate_ignored"

    assert StripeWebhookEvent.objects.filter(stripe_event_id="evt_stripe_upgrade_1").count() == 1

    with tenant_context(org.id, actor_id=owner.id):
        sub = Subscription.objects.get(organization=org)
        assert sub.plan_tier == Subscription.PlanTier.PRO
        # Upgraded quota now allows requests!
        enforce_quota(org, UsageRecord.Metric.AI_REQUESTS, 1)
