import React, { useEffect, useState } from 'react';
import { GitBranch, Play, Plus, Power, Trash2, X } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { Workflow, WorkflowActionDef, WorkflowExecution } from '../../types/api';
import { ConfirmDialog, EmptyState, ErrorBanner, LoadingSkeleton, SuccessBanner } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';
import { formatDateTimePK } from '../../utils/format';

export const WorkflowsSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<Workflow['trigger_type']>('lead_captured');
  const [condField, setCondField] = useState('email');
  const [condOp, setCondOp] = useState<'exists' | 'gte' | 'contains' | 'eq'>('exists');
  const [condValue, setCondValue] = useState('');
  const [selectedAction, setSelectedAction] = useState<WorkflowActionDef['type']>('ai_qualify_lead');
  const [includeHubspot, setIncludeHubspot] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [wfRes, exRes] = await Promise.all([api.listWorkflows(), api.listWorkflowExecutions()]);
      setWorkflows(wfRes.results);
      setExecutions(exRes.results);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load workflows.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadData();
  }, [activeOrg?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const actions: WorkflowActionDef[] = [{ type: selectedAction, config: {} }];
    if (includeHubspot && selectedAction !== 'hubspot_create_contact') {
      actions.push({ type: 'hubspot_create_contact', config: { min_score: 60 } });
    }
    try {
      await api.createWorkflow({
        name: name.trim(),
        trigger_type: triggerType,
        conditions: {
          operator: 'AND',
          rules: [{ field: condField, op: condOp, value: condValue || undefined }],
        },
        actions,
      });
      setName('');
      setShowBuilder(false);
      setNotice('Workflow created and active.');
      loadData();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to create workflow.');
    }
  };

  const handleRunTest = async (wf: Workflow) => {
    try {
      await api.triggerWorkflow(wf.id, { email: 'test-trigger@example.com', qualification_score: 75 });
      setNotice(`Dispatched workflow "${wf.name}" to Celery queue.`);
      loadData();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to trigger workflow.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteWorkflow(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to delete workflow.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Workflows</h1>
          <p className="ff-page-subtitle">
            TRIGGER → CONDITION → ACTION automation pipelines executed idempotently in Celery.
          </p>
        </div>
        <button type="button" onClick={() => setShowBuilder((s) => !s)} className="ff-btn ff-btn-primary">
          {showBuilder ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{showBuilder ? 'Close Builder' : 'New Workflow'}</span>
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      {showBuilder && (
        <form onSubmit={handleCreate} className="ff-card-padded space-y-4">
          <h2 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">Workflow Builder</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="wf-name" className="ff-label">
                Workflow Name
              </label>
              <input
                id="wf-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Qualify & Sync Real Estate Leads"
                className="ff-input"
              />
            </div>
            <div>
              <label htmlFor="wf-trigger" className="ff-label">
                1. Trigger
              </label>
              <select
                id="wf-trigger"
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as Workflow['trigger_type'])}
                className="ff-select"
              >
                <option value="lead_captured">New Lead Captured</option>
                <option value="new_conversation">New Chat Conversation</option>
                <option value="document_indexed">Document Processing Completed</option>
                <option value="webhook_received">Webhook Received</option>
                <option value="ai_event">Specific AI Event</option>
                <option value="scheduled">Scheduled Event</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="wf-field" className="ff-label">
                2. Condition Field
              </label>
              <input
                id="wf-field"
                type="text"
                value={condField}
                onChange={(e) => setCondField(e.target.value)}
                className="ff-input font-mono"
              />
            </div>
            <div>
              <label htmlFor="wf-op" className="ff-label">
                Operator
              </label>
              <select
                id="wf-op"
                value={condOp}
                onChange={(e) => setCondOp(e.target.value as 'exists' | 'gte' | 'contains' | 'eq')}
                className="ff-select"
              >
                <option value="exists">Exists</option>
                <option value="gte">Greater or equal (&gt;=)</option>
                <option value="contains">Contains</option>
                <option value="eq">Equals</option>
              </select>
            </div>
            <div>
              <label htmlFor="wf-val" className="ff-label">
                Target Value (if needed)
              </label>
              <input
                id="wf-val"
                type="text"
                value={condValue}
                onChange={(e) => setCondValue(e.target.value)}
                className="ff-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="wf-action" className="ff-label">
                3. Primary Action
              </label>
              <select
                id="wf-action"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value as WorkflowActionDef['type'])}
                className="ff-select"
              >
                <option value="ai_qualify_lead">AI Lead Qualification</option>
                <option value="hubspot_create_contact">Create HubSpot CRM Contact</option>
                <option value="send_notification">Send Workspace Notification</option>
                <option value="send_webhook">Send Signed Outbound Webhook</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--ff-text-secondary)]">
                <input
                  type="checkbox"
                  className="ff-checkbox"
                  checked={includeHubspot}
                  onChange={(e) => setIncludeHubspot(e.target.checked)}
                />
                <span>Chain HubSpot CRM sync when score ≥ 60</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--ff-border)] pt-4">
            <button type="button" onClick={() => setShowBuilder(false)} className="ff-btn ff-btn-secondary">
              Cancel
            </button>
            <button type="submit" className="ff-btn ff-btn-primary">
              Save Workflow
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : workflows.length === 0 ? (
        <EmptyState
          title="No automation workflows"
          description="Create a workflow to qualify leads and sync them to HubSpot automatically."
          actionLabel="Create Workflow"
          onAction={() => setShowBuilder(true)}
        />
      ) : (
        <div className="space-y-6">
          <div className="ff-table-wrap">
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Trigger</th>
                  <th>Runs</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((wf) => (
                  <tr key={wf.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <GitBranch className="h-4 w-4 shrink-0 text-[var(--ff-royal-text)]" />
                        <span className="font-semibold text-[var(--ff-text-primary)]">{wf.name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-[var(--ff-text-secondary)]">{wf.trigger_type}</td>
                    <td className="font-mono text-xs tabular-nums text-[var(--ff-text-primary)]">
                      {wf.execution_count}
                    </td>
                    <td>
                      <StatusText status={wf.is_active ? 'active' : 'disconnected'} label={wf.is_active ? 'Active' : 'Paused'} />
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRunTest(wf)}
                          className="ff-btn ff-btn-secondary ff-btn-sm"
                        >
                          <Play className="h-3.5 w-3.5 text-[var(--ff-teal)]" />
                          <span>Run</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.toggleWorkflow(wf.id);
                            loadData();
                          }}
                          aria-label={`Toggle ${wf.name}`}
                          className="ff-btn ff-btn-secondary ff-btn-sm px-2"
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(wf)}
                          aria-label={`Delete ${wf.name}`}
                          className="ff-btn ff-btn-danger-outline ff-btn-sm px-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {executions.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">Execution History</h2>
              <div className="ff-table-wrap">
                <table className="ff-table">
                  <thead>
                    <tr>
                      <th>Workflow</th>
                      <th>Idempotency Key</th>
                      <th>Status</th>
                      <th className="text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.slice(0, 10).map((ex) => (
                      <tr key={ex.id}>
                        <td>
                          <div className="font-medium text-[var(--ff-text-primary)]">{ex.workflow_name}</div>
                          {ex.error_message && <p className="mt-0.5 text-xs text-[var(--ff-danger)]">{ex.error_message}</p>}
                        </td>
                        <td className="font-mono text-xs text-[var(--ff-text-muted)]">
                          {ex.idempotency_key.slice(0, 14)}
                        </td>
                        <td>
                          <StatusText status={ex.status} />
                        </td>
                        <td className="text-right font-mono text-xs tabular-nums text-[var(--ff-text-muted)]">
                          {formatDateTimePK(ex.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Workflow"
        description={`Delete workflow "${deleteTarget?.name}" and its execution history?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
