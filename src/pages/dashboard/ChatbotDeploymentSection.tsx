import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { AIAgent } from '../../types/api';
import { EmptyState, ErrorBanner, LoadingSkeleton, SuccessBanner } from '../../components/ui/StateViews';

export const ChatbotDeploymentSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [welcomeText, setWelcomeText] = useState('Hello! Ask me about available properties or schedule a viewing.');
  const [primaryColor, setPrimaryColor] = useState('#1d4ed8');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await api.listAgents();
        if (!active) return;
        setAgents(res.results);
        if (res.results.length > 0) {
          const first = res.results[0];
          setSelectedId(first.id);
          if (typeof first.widget_config?.welcome_message === 'string') {
            setWelcomeText(first.widget_config.welcome_message);
          }
          if (typeof first.widget_config?.primary_color === 'string') {
            setPrimaryColor(first.widget_config.primary_color);
          }
        }
      } catch (err) {
        if (active) setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load agents.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (activeOrg) load();
    return () => {
      active = false;
    };
  }, [activeOrg?.id]);

  const selected = agents.find((a) => a.id === selectedId) || null;
  const widgetUrl = selected ? `${window.location.origin}/widget/${selected.public_embed_key}` : '';
  const embedSnippet = selected
    ? `<iframe src="${widgetUrl}" width="420" height="640" style="border:1px solid #e2e8f0;border-radius:12px;" title="${selected.name}"></iframe>`
    : '';

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const updated = await api.updateAgent(selected.id, {
        widget_config: { welcome_message: welcomeText, primary_color: primaryColor },
      });
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setNotice('Widget deployment settings saved.');
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to save widget configuration.');
    }
  };

  const handleCopy = () => {
    if (!embedSnippet) return;
    navigator.clipboard?.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading) return <LoadingSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Chatbot Deployment</h1>
          <p className="ff-page-subtitle">
            Customize and embed your customer-facing AI chatbot backed by tenant-isolated RAG.
          </p>
        </div>
        {selected && (
          <Link
            to={`/widget/${selected.public_embed_key}`}
            target="_blank"
            className="ff-btn ff-btn-secondary"
          >
            <Globe className="h-4 w-4 text-[var(--ff-teal)]" />
            <span>Open Live Widget</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      {!selected ? (
        <EmptyState
          title="No deployable AI agents"
          description="Create an AI agent first to generate a public embed key and live chatbot widget."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={handleSaveConfig} className="ff-card-padded space-y-4">
            <div>
              <label htmlFor="deploy-agent" className="ff-label">
                Target AI Agent
              </label>
              <select
                id="deploy-agent"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="ff-select"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="deploy-greeting" className="ff-label">
                Welcome Greeting
              </label>
              <textarea
                id="deploy-greeting"
                rows={2}
                value={welcomeText}
                onChange={(e) => setWelcomeText(e.target.value)}
                className="ff-textarea"
              />
            </div>

            <div>
              <label htmlFor="deploy-color" className="ff-label">
                Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="deploy-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-[var(--ff-border)] bg-transparent p-0.5"
                />
                <span className="font-mono text-xs text-[var(--ff-text-secondary)]">{primaryColor}</span>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="ff-label mb-0">Embed Code</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ff-royal-text)] hover:underline"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy snippet'}</span>
                </button>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] p-3 font-mono text-xs text-[var(--ff-text-secondary)]">
                {embedSnippet}
              </pre>
            </div>

            <div className="flex justify-end border-t border-[var(--ff-border)] pt-4">
              <button type="submit" className="ff-btn ff-btn-primary">
                Save Configuration
              </button>
            </div>
          </form>

          <div className="ff-card flex flex-col overflow-hidden">
            <div className="relative h-40 w-full overflow-hidden bg-[var(--ff-bg-navy)]">
              {!imgError ? (
                <img
                  src="/src/assets/images/agent_property_assistant_1795010567965.jpg"
                  alt="Property Assistant architectural showcase"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover opacity-80"
                />
              ) : (
                <div className="h-full w-full bg-[var(--ff-bg-navy)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
              <div className="absolute bottom-3 left-5 right-5 text-white">
                <p className="font-display text-sm font-semibold">{selected.name}</p>
                <p className="truncate font-mono text-xs text-slate-300">
                  Public Widget Preview · {selected.public_embed_key.slice(0, 14)}…
                </p>
              </div>
            </div>
            <div className="flex-1 space-y-3 p-5">
              <div className="max-w-[85%] rounded-xl border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] px-4 py-3 text-sm text-[var(--ff-text-primary)]">
                {welcomeText}
              </div>
              <div className="flex justify-end">
                <div
                  className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Do you have 1 Kanal residential plots available in Phase 6?
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
