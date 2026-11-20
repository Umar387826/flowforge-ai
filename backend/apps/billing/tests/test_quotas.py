from unittest import TestCase
from unittest.mock import patch
from apps.billing.models import UsageRecord
from apps.billing.services import enforce_quota, QuotaExceededError


class BillingQuotaTests(TestCase):
    @patch("apps.billing.services.get_usage_summary")
    @patch("apps.billing.services.get_org_plan_limits")
    def test_request_within_quota_is_allowed(self, limits_mock, usage_mock):
        limits_mock.return_value = {"max_ai_requests_monthly": 100}
        usage_mock.return_value = {"ai_requests": 20}

        enforce_quota(object(), UsageRecord.Metric.AI_REQUESTS, 1)

    @patch("apps.billing.services.get_usage_summary")
    @patch("apps.billing.services.get_org_plan_limits")
    def test_request_exceeding_quota_is_rejected(self, limits_mock, usage_mock):
        limits_mock.return_value = {"max_ai_requests_monthly": 100}
        usage_mock.return_value = {"ai_requests": 100}

        with self.assertRaises(QuotaExceededError):
            enforce_quota(object(), UsageRecord.Metric.AI_REQUESTS, 1)

    @patch("apps.billing.services.get_usage_summary")
    @patch("apps.billing.services.get_org_plan_limits")
    def test_agent_limit_is_enforced(self, limits_mock, usage_mock):
        limits_mock.return_value = {"max_agents": 2}
        usage_mock.return_value = {"agents": 2}

        with self.assertRaises(QuotaExceededError):
            enforce_quota(object(), "agents", 1)
