import React, { useEffect, useState } from 'react';
import { BookOpen, Bot, MessageSquare, Plus, Power, Trash2, X } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { AIAgent, KnowledgeBase } from '../../types/api';
import { ConfirmDialog, EmptyState, ErrorBanner, LoadingSkeleton, SuccessBanner } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';

export const AgentsSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIAgent | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemInstructions, setSystemInstructions] = useState(
    'You are Property Assistant. Answer questions using only the provided property brochures and collect buyer contact details when appropriate.',
  );
  const [llmProvider, setLlmProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [modelName, setModelName] = useState('claude-3-5-sonnet-20241022');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [captureLeadEnabled, setCaptureLeadEnabled] = useState(true);

  const [testAgent, setTestAgent] = useState<AIAgent | null>(null);
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<{ answer: string; citations: unknown[] } | null>(null);
  const [testing, setTesting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [agentRes, kbRes] = await Promise.all([api.listAgents(), api.listKnowledgeBases()]);
      setAgents(agentRes.results);
      setKbs(kbRes.results);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load AI agents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadData();
  }, [activeOrg?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Agent name is required.');
      return;
    }
    try {
      await api.createAgent({
        name: name.trim(),
        description: description.trim(),
        system_instructions: systemInstructions.trim(),
        llm_provider: llmProvider,
        model_name: modelName.trim(),
        temperature,
        max_tokens: maxTokens,
        knowledge_base_ids: selectedKbIds,
        enabled_tools: captureLeadEnabled ? ['capture_lead'] : [],
      });
      setName('');
      setDescription('');
      setShowForm(false);
      setNotice('AI Agent created.');
      loadData();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to create agent.');
    }
  };

  const handleToggle = async (agent: AIAgent) => {
    try {
      await api.toggleAgent(agent.id);
      loadData();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to update agent status.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteAgent(deleteTarget.id);
      setDeleteTarget(null);
      setNotice('Agent deleted.');
      loadData();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to delete agent.');
    }
  };

  const handleTestQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testAgent || !testPrompt.trim()) return;
    setTesting(true);
    setError('');
    setTestResult(null);
    try {
      const res = await api.testAgentQuery(testAgent.id, testPrompt.trim());
      setTestResult({ answer: res.answer, citations: res.citations });
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Agent query failed.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">AI Agents</h1>
          <p className="ff-page-subtitle">
            Configure LLM providers, system instructions, knowledge bases, and structured lead capture tools.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm((s) => !s)} className="ff-btn ff-btn-primary">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{showForm ? 'Close Form' : 'New AI Agent'}</span>
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      {showForm && (
        <form onSubmit={handleCreate} className="ff-card-padded space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--ff-border)] pb-3">
            <h2 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">Create AI Agent</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="agent-name" className="ff-label">
                Agent Name
              </label>
              <input
                id="agent-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Property Assistant"
                className="ff-input"
              />
            </div>
            <div>
              <label htmlFor="agent-provider" className="ff-label">
                LLM Provider
              </label>
              <select
                id="agent-provider"
                value={llmProvider}
                onChange={(e) => {
                  const val = e.target.value as 'anthropic' | 'openai';
                  setLlmProvider(val);
                  setModelName(val === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o-mini');
                }}
                className="ff-select"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label htmlFor="agent-model" className="ff-label">
                Model
              </label>
              <input
                id="agent-model"
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="ff-input font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="agent-temp" className="ff-label">
                  Temperature
                </label>
                <input
                  id="agent-temp"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
                  className="ff-input font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="agent-tokens" className="ff-label">
                  Max Tokens
                </label>
                <input
                  id="agent-tokens"
                  type="number"
                  min="128"
                  max="4096"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 1024)}
                  className="ff-input font-mono tabular-nums"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="agent-desc" className="ff-label">
              Description
            </label>
            <input
              id="agent-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Handles inbound property inquiries and captures buyer leads."
              className="ff-input"
            />
          </div>

          <div>
            <label htmlFor="agent-instructions" className="ff-label">
              System Instructions
            </label>
            <textarea
              id="agent-instructions"
              rows={3}
              value={systemInstructions}
              onChange={(e) => setSystemInstructions(e.target.value)}
              className="ff-textarea"
            />
          </div>

          {kbs.length > 0 && (
            <div>
              <span className="ff-label">Attach Knowledge Bases</span>
              <div className="mt-1.5 flex flex-wrap gap-3">
                {kbs.map((kb) => (
                  <label
                    key={kb.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--ff-text-secondary)]"
                  >
                    <input
                      type="checkbox"
                      className="ff-checkbox"
                      checked={selectedKbIds.includes(kb.id)}
                      onChange={(e) =>
                        setSelectedKbIds((prev) =>
                          e.target.checked ? [...prev, kb.id] : prev.filter((id) => id !== kb.id),
                        )
                      }
                    />
                    <span>{kb.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--ff-text-secondary)]">
            <input
              type="checkbox"
              className="ff-checkbox"
              checked={captureLeadEnabled}
              onChange={(e) => setCaptureLeadEnabled(e.target.checked)}
            />
            <span>Enable structured lead capture tool calling</span>
          </label>

          <div className="flex justify-end gap-3 border-t border-[var(--ff-border)] pt-4">
            <button type="button" onClick={() => setShowForm(false)} className="ff-btn ff-btn-secondary">
              Cancel
            </button>
            <button type="submit" className="ff-btn ff-btn-primary">
              Create Agent
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : agents.length === 0 ? (
        <EmptyState
          title="No AI agents configured"
          description="Create your first AI agent to connect knowledge bases and deploy a customer-facing chatbot."
          actionLabel="Create AI Agent"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="ff-table-wrap">
          <table className="ff-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Model</th>
                <th>Knowledge Bases</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--ff-royal-soft)] text-[var(--ff-royal-text)]">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--ff-text-primary)]">{agent.name}</div>
                        <div className="truncate max-w-xs text-xs text-[var(--ff-text-muted)]">
                          {agent.description || 'No description'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-[var(--ff-text-secondary)]">
                    {agent.llm_provider} / {agent.model_name}
                  </td>
                  <td className="font-mono text-xs tabular-nums text-[var(--ff-text-secondary)]">
                    {agent.knowledge_base_ids.length}
                  </td>
                  <td>
                    <StatusText
                      status={agent.is_active ? 'active' : 'disconnected'}
                      label={agent.is_active ? 'Active' : 'Inactive'}
                    />
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTestAgent(agent);
                          setTestResult(null);
                        }}
                        className="ff-btn ff-btn-secondary ff-btn-sm"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Test</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(agent)}
                        title="Toggle active state"
                        aria-label={`Toggle ${agent.name}`}
                        className="ff-btn ff-btn-secondary ff-btn-sm px-2"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(agent)}
                        title="Delete agent"
                        aria-label={`Delete ${agent.name}`}
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
      )}

      {testAgent && (
        <div className="ff-card-padded space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--ff-border)] pb-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">
              Grounded RAG Test Console — {testAgent.name}
            </h3>
            <button type="button" onClick={() => setTestAgent(null)} className="ff-btn ff-btn-ghost ff-btn-sm">
              Close
            </button>
          </div>
          <form onSubmit={handleTestQuery} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Ask a question from attached knowledge bases..."
              className="ff-input flex-1"
            />
            <button type="submit" disabled={testing} className="ff-btn ff-btn-primary">
              {testing ? 'Running...' : 'Ask Agent'}
            </button>
          </form>
          {testResult && (
            <div className="space-y-2 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] p-4 text-sm">
              <p className="whitespace-pre-wrap leading-relaxed text-[var(--ff-text-primary)]">{testResult.answer}</p>
              {testResult.citations.length > 0 && (
                <p className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--ff-teal-text)]">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Sources cited: {testResult.citations.length}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete AI Agent"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? Existing conversations referencing it will be archived.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
