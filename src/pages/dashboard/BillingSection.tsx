import React, { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, ExternalLink } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { PlanQuota, SubscriptionInfo } from '../../types/api';
import { ConfirmDialog, ErrorBanner, LoadingSkeleton, SuccessBanner } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';
import { formatDatePK, formatPKR } from '../../utils/format';

export const BillingSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Record<string, PlanQuota>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const loadBilling = async () => {
    setLoading(true);
    try {
      const [subRes, plansRes] = await Promise.all([api.getSubscription(), api.listPlans()]);
      setSubInfo(subRes);
      setPlans(plansRes.plans);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load billing information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadBilling();
  }, [activeOrg?.id]);

  const handleUpgrade = async (tier: string) => {
    setError('');
    try {
      const res = await api.createCheckoutSession(tier);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      }
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Unable to start Stripe checkout.');
    }
  };

  const handlePortal = async () => {
    setError('');
    try {
      const res = await api.createBillingPortal();
      if (res.portal_url) {
        window.location.href = res.portal_url;
      }
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Unable to open Stripe billing portal.');
    }
  };

  const handleCancel = async () => {
    try {
      await api.cancelSubscription();
      setConfirmCancel(false);
      setNotice('Subscription cancellation scheduled at end of billing period.');
      loadBilling();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Cancellation failed.');
    }
  };

  if (loading) return <LoadingSkeleton rows={5} />;

  const currentTier = subInfo?.subscription.plan_tier || 'free';

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Billing &amp; Plans</h1>
          <p className="ff-page-subtitle">
            Stripe test-mode subscriptions, quota entitlements, and invoice history.
          </p>
        </div>

        {subInfo && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handlePortal} className="ff-btn ff-btn-secondary ff-btn-sm">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Stripe Customer Portal</span>
            </button>
            {currentTier !== 'free' && !subInfo.subscription.cancel_at_period_end && (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="ff-btn ff-btn-danger-outline ff-btn-sm"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      {subInfo && !subInfo.stripe_configured && (
        <div className="rounded-[var(--ff-radius-md)] border border-[rgba(217,119,6,0.3)] bg-[var(--ff-warning-soft)] px-4 py-3 text-xs text-[var(--ff-warning)]">
          Stripe is awaiting test-mode credentials (<code className="font-mono font-semibold">STRIPE_SECRET_KEY</code> and{' '}
          <code className="font-mono font-semibold">STRIPE_WEBHOOK_SECRET</code>). Configure them in{' '}
          <code className="font-mono font-semibold">.env</code> to launch live Checkout sessions.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {Object.entries(plans).map(([tier, plan]) => {
          const isCurrent = tier === currentTier;
          const pkr = plan.price_monthly_pkr ?? Math.round((plan.price_monthly_cents / 100) * 280);
          const usd = plan.price_monthly_cents / 100;
          const audience =
            tier === 'free'
              ? 'For evaluation & small pilots'
              : tier === 'pro'
                ? 'For scaling Pakistani & global teams'
                : 'For high-volume multi-agent enterprises';

          return (
            <div
              key={tier}
              className={`ff-card-padded flex flex-col justify-between ${
                isCurrent ? 'border-[var(--ff-royal)] ring-1 ring-[var(--ff-royal)]' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-[var(--ff-text-primary)]">{plan.name}</h2>
                  {isCurrent && <StatusText status={subInfo?.subscription.status || 'active'} label="Current Plan" />}
                </div>
                <p className="mt-1 text-xs text-[var(--ff-text-muted)]">{audience}</p>
                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-2xl font-bold tabular-nums text-[var(--ff-text-primary)]">
                    {formatPKR(pkr)}
                  </span>
                  <span className="text-xs text-[var(--ff-text-muted)]">
                    / month{usd > 0 ? ` ($${usd.toFixed(0)} USD)` : ''}
                  </span>
                </div>

                <dl className="mt-5 space-y-2.5 border-t border-[var(--ff-border)] pt-4 text-xs">
                  {[
                    ['AI Agents', String(plan.max_agents)],
                    ['Monthly AI Requests', plan.max_ai_requests_monthly.toLocaleString()],
                    ['Monthly LLM Tokens', plan.max_tokens_monthly.toLocaleString()],
                    ['Documents / Storage', `${plan.max_documents} / ${plan.max_storage_mb} MB`],
                    ['Workflow Runs / mo', plan.max_workflow_executions_monthly.toLocaleString()],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <dt className="flex items-center gap-1.5 text-[var(--ff-text-secondary)]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--ff-teal)]" />
                        <span>{label}</span>
                      </dt>
                      <dd className="font-mono font-medium tabular-nums text-[var(--ff-text-primary)]">{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {tier !== 'free' && !isCurrent && (
                <button
                  type="button"
                  onClick={() => handleUpgrade(tier)}
                  className="ff-btn ff-btn-primary mt-6 w-full"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Upgrade to {plan.name}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {subInfo && subInfo.invoices.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">Billing History</h2>
          <div className="ff-table-wrap">
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Invoice Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {subInfo.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs text-[var(--ff-text-primary)]">{inv.stripe_invoice_id}</td>
                    <td className="font-mono text-xs tabular-nums text-[var(--ff-text-secondary)]">
                      ${(inv.amount_paid_cents / 100).toFixed(2)} {inv.currency.toUpperCase()}
                    </td>
                    <td>
                      <StatusText status={inv.status} />
                    </td>
                    <td className="text-right font-mono text-xs tabular-nums text-[var(--ff-text-muted)]">
                      {formatDatePK(inv.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel Subscription"
        description="Your organization will remain on the current plan until the end of the billing period, then revert to Free limits."
        confirmLabel="Confirm Cancellation"
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
};
