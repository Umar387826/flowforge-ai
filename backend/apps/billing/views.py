from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
import stripe
from apps.audit.services import log_audit_event
from apps.billing.models import InvoiceHistory, Subscription
from apps.billing.services import (
    create_billing_portal_session,
    create_checkout_session,
    ensure_free_subscription,
    get_org_plan_limits,
    get_usage_summary,
    process_stripe_webhook,
)
from apps.common.mixins import TenantScopedMixin
from apps.common.permissions import IsOrganizationAdmin, IsOrganizationMember


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = [
            "id",
            "plan_tier",
            "status",
            "current_period_start",
            "current_period_end",
            "cancel_at_period_end",
            "created_at",
            "updated_at",
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceHistory
        fields = ["id", "stripe_invoice_id", "amount_paid_cents", "currency", "status", "invoice_pdf_url", "created_at"]


class PlansView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"plans": settings.PLAN_QUOTAS})


class CurrentSubscriptionView(TenantScopedMixin, APIView):
    permission_classes = [IsOrganizationMember]

    def get(self, request):
        sub = ensure_free_subscription(request.organization)
        limits = get_org_plan_limits(request.organization)
        usage = get_usage_summary(request.organization)
        invoices = InvoiceHistory.objects.filter(organization=request.organization)[:20]
        return Response(
            {
                "subscription": SubscriptionSerializer(sub).data,
                "limits": limits,
                "usage": usage,
                "invoices": InvoiceSerializer(invoices, many=True).data,
                "stripe_configured": bool(settings.STRIPE_SECRET_KEY),
            }
        )


class CheckoutSessionView(TenantScopedMixin, APIView):
    permission_classes = [IsOrganizationAdmin]

    def post(self, request):
        plan_tier = request.data.get("plan_tier", Subscription.PlanTier.PRO)
        result = create_checkout_session(request.organization, plan_tier, request.user.email)
        log_audit_event(
            request.organization, request.user, "billing.checkout_initiated", "Subscription",
            metadata={"plan_tier": plan_tier}, request=request
        )
        return Response(result)


class BillingPortalView(TenantScopedMixin, APIView):
    permission_classes = [IsOrganizationAdmin]

    def post(self, request):
        return Response(create_billing_portal_session(request.organization))


class CancelSubscriptionView(TenantScopedMixin, APIView):
    permission_classes = [IsOrganizationAdmin]

    def post(self, request):
        sub = ensure_free_subscription(request.organization)
        if sub.stripe_subscription_id and settings.STRIPE_SECRET_KEY:
            stripe.api_key = settings.STRIPE_SECRET_KEY
            stripe.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=True)
        sub.cancel_at_period_end = True
        sub.save(update_fields=["cancel_at_period_end", "updated_at"])
        log_audit_event(
            request.organization, request.user, "billing.subscription_cancel_scheduled", "Subscription", str(sub.id), request=request
        )
        return Response(SubscriptionSerializer(sub).data)


@method_decorator(csrf_exempt, name="dispatch")
class StripeWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        result = process_stripe_webhook(request.body, sig_header)
        return Response(result, status=status.HTTP_200_OK)
