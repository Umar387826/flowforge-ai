from django.urls import path
from apps.billing.views import (
    BillingPortalView,
    CancelSubscriptionView,
    CheckoutSessionView,
    CurrentSubscriptionView,
    PlansView,
    StripeWebhookView,
)

urlpatterns = [
    path("plans/", PlansView.as_view(), name="billing-plans"),
    path("subscription/", CurrentSubscriptionView.as_view(), name="billing-subscription"),
    path("checkout/", CheckoutSessionView.as_view(), name="billing-checkout"),
    path("portal/", BillingPortalView.as_view(), name="billing-portal"),
    path("cancel/", CancelSubscriptionView.as_view(), name="billing-cancel"),
    path("webhook/", StripeWebhookView.as_view(), name="billing-stripe-webhook"),
]
