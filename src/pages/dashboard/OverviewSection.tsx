import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bot,
  CreditCard,
  FileText,
  GitBranch,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { AnalyticsOverview, AuditLogItem, WorkflowExecution } from '../../types/api';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';
import {
  DonutSummaryChart,
  HorizontalMetricChart,
  VerticalColumnChart,
} from '../../components/ui/Charts';
import { formatDatePK, formatTimePK } from '../../utils/format';

export const OverviewSection: React.FC<{ onNavigate: (section: string) => void }> = ({ onNavigate }) => {
  const { activeOrg } = useAuth();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [overviewRes, execRes, auditRes] = await Promise.allSettled([
          api.getAnalyticsOverview(),
          api.listWorkflowExecutions(),
          api.listAuditLogs(1),
        ]);
        if (!active) return;

        if (overviewRes.status === 'fulfilled') {
          setData(overviewRes.value);
        } else {
          const err = overviewRes.reason;
          setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load workspace overview.');
        }

        if (execRes.status === 'fulfilled') {
          setExecutions(execRes.value.results.slice(0, 6));
        }
        if (auditRes.status === 'fulfilled') {
          setAuditLogs(auditRes.value.results.slice(0, 6));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    if (activeOrg) load();
    return () => {
      active = false;
    };
  }, [activeOrg?.id]);

  if (loading) return <LoadingSkeleton rows={6} />;

  const kpiCards = data
    ? [
        {
          label: 'Active AI Agents',
          value: data.kpis.active_agents,
          detail: `${data.kpis.total_agents} configured · ${data.limits.max_agents} plan limit`,
          ratio: `${data.limits.max_agents > 0 ? Math.round((data.usage.agents / data.limits.max_agents) * 100) : 0}% capacity`,
          Icon: Bot,
          tone: 'text-[var(--ff-royal-text)] bg-[var(--ff-royal-soft)]',
        },
        {
          label: 'Indexed Documents',
          value: data.kpis.indexed_documents,
          detail: `${data.usage.storage_mb} MB / ${data.limits.max_storage_mb} MB storage`,
          ratio: `${data.limits.max_documents > 0 ? Math.round((data.usage.documents / data.limits.max_documents) * 100) : 0}% quota`,
          Icon: FileText,
          tone: 'text-[var(--ff-teal-text)] bg-[var(--ff-teal-soft)]',
        },
        {
          label: 'Qualified Leads',
          value: data.kpis.qualified_leads,
          detail: `${data.kpis.total_leads} total captured contacts`,
          ratio:
            data.kpis.total_leads > 0
              ? `${Math.round((data.kpis.qualified_leads / data.kpis.total_leads) * 100)}% qualified`
              : '0% qualified',
          Icon: Users,
          tone: 'text-[var(--ff-success)] bg-[var(--ff-success-soft)]',
        },
        {
          label: 'Workflow Runs',
          value: data.kpis.successful_workflow_runs,
          detail: `${data.kpis.active_workflows} active automation flows`,
          ratio: `${data.usage.workflow_executions} this month`,
          Icon: GitBranch,
          tone: 'text-[var(--ff-royal-text)] bg-[var(--ff-royal-soft)]',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">{activeOrg?.name || 'Workspace'} Overview</h1>
          <p className="ff-page-subtitle">
            Live organization telemetry, RAG document indexing, qualified leads, and monthly plan utilization.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => onNavigate('billing')} className="ff-btn ff-btn-secondary">
            <CreditCard className="h-4 w-4" />
            <span>Subscription</span>
          </button>
          <button type="button" onClick={() => onNavigate('agents')} className="ff-btn ff-btn-primary">
            <span>Configure AI Agents</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.Icon;
              return (
                <div key={kpi.label} className="ff-kpi-card">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold text-[var(--ff-text-secondary)]">{kpi.label}</p>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${kpi.tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[var(--ff-text-primary)]">
                    {kpi.value.toLocaleString()}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-[var(--ff-text-muted)]">{kpi.detail}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-medium tabular-nums text-[var(--ff-teal-text)]">
                      <TrendingUp className="h-3 w-3" />
                      {kpi.ratio}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <VerticalColumnChart
                title="Workspace Activity Distribution"
                subtitle="Live counts across conversations, captured leads, indexed documents, and workflow runs"
                data={[
                  { label: 'Agents', value: data.kpis.total_agents, tone: 'royal' },
                  { label: 'Docs', value: data.kpis.indexed_documents, tone: 'teal' },
                  { label: 'Chats', value: data.kpis.total_conversations, tone: 'royal' },
                  { label: 'Leads', value: data.kpis.total_leads, tone: 'teal' },
                  { label: 'Workflows', value: data.kpis.successful_workflow_runs, tone: 'amber' },
                ]}
              />
            </div>

            <div className="lg:col-span-5">
              <DonutSummaryChart
                title="Lead Qualification Breakdown"
                subtitle="Conversion of inbound leads captured via widgets and APIs"
                centerLabel="Total Leads"
                segments={[
                  {
                    label: 'Qualified Leads',
                    value: data.kpis.qualified_leads,
                    color: 'var(--ff-teal)',
                  },
                  {
                    label: 'Pending / Other',
                    value: Math.max(0, data.kpis.total_leads - data.kpis.qualified_leads),
                    color: 'var(--ff-royal)',
                  },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <HorizontalMetricChart
                title={`AI Usage & Monthly Plan Entitlements (${data.limits.name})`}
                subtitle={`Billing cycle ${data.usage.period} · Enforced server-side across API, WebSockets & Celery`}
                items={[
                  {
                    label: 'AI Requests',
                    value: data.usage.ai_requests,
                    max: data.limits.max_ai_requests_monthly,
                    tone: 'royal',
                  },
                  {
                    label: 'LLM Tokens Consumed',
                    value: data.usage.tokens,
                    max: data.limits.max_tokens_monthly,
                    tone: 'teal',
                  },
                  {
                    label: 'Workflow Executions',
                    value: data.usage.workflow_executions,
                    max: data.limits.max_workflow_executions_monthly,
                    tone: 'royal',
                  },
                  {
                    label: 'Document Storage (MB)',
                    value: data.usage.storage_mb,
                    max: data.limits.max_storage_mb,
                    tone: 'amber',
                  },
                ]}
              />
            </div>

            <div className="ff-card-padded flex flex-col justify-between lg:col-span-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">
                      Subscription &amp; Quick Actions
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--ff-text-muted)]">
                      Active tier: <span className="font-semibold text-[var(--ff-text-primary)]">{data.limits.name}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('billing')}
                    className="ff-btn ff-btn-secondary ff-btn-sm"
                  >
                    Manage Plan
                  </button>
                </div>

                <div className="mt-4 space-y-2.5">
                  {[
                    {
                      title: 'Knowledge & Documents',
                      desc: 'Upload PDF brochures & price lists into pgvector.',
                      target: 'documents',
                    },
                    {
                      title: 'Real-Time Chat & Widget',
                      desc: 'Test WebSocket RAG streaming or embed on your site.',
                      target: 'conversations',
                    },
                    {
                      title: 'Workflow Automation',
                      desc: 'Qualify buyer leads and sync directly to HubSpot CRM.',
                      target: 'workflows',
                    },
                  ].map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => onNavigate(item.target)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] p-3 text-left transition-colors hover:border-[var(--ff-royal)]"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--ff-text-primary)]">{item.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--ff-text-muted)]">{item.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ff-royal-text)]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">
                  Recent Workflow Executions
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('workflows')}
                  className="text-xs font-medium text-[var(--ff-royal-text)] hover:underline"
                >
                  View workflows
                </button>
              </div>
              {executions.length === 0 ? (
                <EmptyState
                  title="No workflow runs yet"
                  description="Triggered automation runs will appear here once leads or webhook events execute."
                />
              ) : (
                <div className="ff-table-wrap">
                  <table className="ff-table">
                    <thead>
                      <tr>
                        <th>Workflow</th>
                        <th>Status</th>
                        <th className="text-right">Executed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executions.map((ex) => (
                        <tr key={ex.id}>
                          <td>
                            <div className="font-medium text-[var(--ff-text-primary)]">{ex.workflow_name}</div>
                            <div className="font-mono text-[11px] text-[var(--ff-text-muted)]">
                              {ex.idempotency_key.slice(0, 14)}
                            </div>
                          </td>
                          <td>
                            <StatusText status={ex.status} />
                          </td>
                          <td className="text-right font-mono text-xs tabular-nums text-[var(--ff-text-muted)]">
                            {formatDatePK(ex.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">
                  Recent Workspace Activity
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('audit')}
                  className="text-xs font-medium text-[var(--ff-royal-text)] hover:underline"
                >
                  Full audit log
                </button>
              </div>
              {auditLogs.length === 0 ? (
                <EmptyState
                  title="No recent activity"
                  description="Security events, agent updates, and billing changes appear in this feed."
                />
              ) : (
                <div className="ff-table-wrap">
                  <table className="ff-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Actor</th>
                        <th className="text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            <div className="flex items-center gap-2 font-mono text-xs text-[var(--ff-text-primary)]">
                              <Activity className="h-3.5 w-3.5 shrink-0 text-[var(--ff-teal)]" />
                              <span className="truncate max-w-[180px]">{log.action}</span>
                            </div>
                            <div className="text-[11px] text-[var(--ff-text-muted)]">{log.resource_type}</div>
                          </td>
                          <td className="text-xs text-[var(--ff-text-secondary)]">{log.actor_email || 'System'}</td>
                          <td className="text-right font-mono text-xs tabular-nums text-[var(--ff-text-muted)]">
                            {formatTimePK(log.created_at)} PKT
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
