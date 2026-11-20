import React, { useEffect, useState } from 'react';
import { Activity, Cpu, Database, Zap } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { AnalyticsOverview } from '../../types/api';
import { ErrorBanner, LoadingSkeleton } from '../../components/ui/StateViews';
import { DonutSummaryChart, VerticalColumnChart } from '../../components/ui/Charts';

export const AnalyticsSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await api.getAnalyticsOverview();
        if (active) setData(res);
      } catch (err) {
        if (active) setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load analytics.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (activeOrg) load();
    return () => {
      active = false;
    };
  }, [activeOrg?.id]);

  if (loading) return <LoadingSkeleton rows={5} />;

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Usage Analytics</h1>
          <p className="ff-page-subtitle">
            Real-time tenant metering across LLM tokens, RAG queries, document storage, and workflow runs.
          </p>
        </div>
        {data && (
          <div className="ff-badge border-[var(--ff-border)] bg-[var(--ff-bg-surface)] text-[var(--ff-text-secondary)]">
            <Activity className="h-3.5 w-3.5 text-[var(--ff-teal)]" />
            <span>
              Period: <span className="font-mono font-semibold text-[var(--ff-text-primary)]">{data.usage.period}</span>
            </span>
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="ff-kpi-card">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--ff-text-secondary)]">
                <span>Monthly AI Requests</span>
                <Zap className="h-4 w-4 text-[var(--ff-royal-text)]" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[var(--ff-text-primary)]">
                {data.usage.ai_requests.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[var(--ff-text-muted)]">
                Limit: {data.limits.max_ai_requests_monthly.toLocaleString()} / mo
              </p>
            </div>
            <div className="ff-kpi-card">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--ff-text-secondary)]">
                <span>LLM Tokens Metered</span>
                <Cpu className="h-4 w-4 text-[var(--ff-teal)]" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[var(--ff-text-primary)]">
                {data.usage.tokens.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[var(--ff-text-muted)]">
                Limit: {data.limits.max_tokens_monthly.toLocaleString()} / mo
              </p>
            </div>
            <div className="ff-kpi-card">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--ff-text-secondary)]">
                <span>Vector Storage</span>
                <Database className="h-4 w-4 text-[var(--ff-royal-text)]" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[var(--ff-text-primary)]">
                {data.usage.storage_mb} MB
              </p>
              <p className="mt-1 text-xs text-[var(--ff-text-muted)]">
                {data.usage.documents} / {data.limits.max_documents} documents indexed
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <VerticalColumnChart
                title="Metered Event Volume"
                subtitle="Current billing cycle usage across core platform dimensions"
                data={[
                  { label: 'AI Reqs', value: data.usage.ai_requests, tone: 'royal' },
                  { label: 'Chats', value: data.usage.conversations, tone: 'teal' },
                  { label: 'Workflows', value: data.usage.workflow_executions, tone: 'royal' },
                  { label: 'API Calls', value: data.usage.api_calls, tone: 'amber' },
                ]}
              />
            </div>
            <div className="lg:col-span-5">
              <DonutSummaryChart
                title="Resource Capacity Split"
                subtitle="Active resource allocations against plan entitlements"
                centerLabel="Plan Tier"
                segments={[
                  { label: 'Agents', value: data.usage.agents, color: 'var(--ff-royal)' },
                  { label: 'Documents', value: data.usage.documents, color: 'var(--ff-teal)' },
                  { label: 'Workflow Runs', value: data.usage.workflow_executions, color: 'var(--ff-warning)' },
                ]}
              />
            </div>
          </div>

          <div className="ff-table-wrap">
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Metered Dimension</th>
                  <th className="text-right">Current Usage</th>
                  <th className="text-right">Plan Limit</th>
                  <th className="w-48">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'AI Requests (Monthly)', used: data.usage.ai_requests, max: data.limits.max_ai_requests_monthly },
                  { label: 'LLM Tokens (Monthly)', used: data.usage.tokens, max: data.limits.max_tokens_monthly },
                  {
                    label: 'Workflow Executions (Monthly)',
                    used: data.usage.workflow_executions,
                    max: data.limits.max_workflow_executions_monthly,
                  },
                  { label: 'AI Agents', used: data.usage.agents, max: data.limits.max_agents },
                  { label: 'Documents', used: data.usage.documents, max: data.limits.max_documents },
                  { label: 'Document Storage (MB)', used: data.usage.storage_mb, max: data.limits.max_storage_mb },
                ].map((row) => {
                  const pct = row.max > 0 ? Math.min(100, Math.round((row.used / row.max) * 100)) : 0;
                  return (
                    <tr key={row.label}>
                      <td className="font-medium text-[var(--ff-text-primary)]">{row.label}</td>
                      <td className="text-right font-mono text-xs tabular-nums text-[var(--ff-text-primary)]">
                        {row.used.toLocaleString()}
                      </td>
                      <td className="text-right font-mono text-xs tabular-nums text-[var(--ff-text-muted)]">
                        {row.max.toLocaleString()}
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="ff-progress-track flex-1">
                            <div className="ff-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-9 text-right font-mono text-xs tabular-nums text-[var(--ff-text-secondary)]">
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
