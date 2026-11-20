import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, Bot, Send, ShieldCheck } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { ChatWebSocketClient } from '../../api/ws';
import type { Citation } from '../../types/api';
import { ErrorBanner } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';

interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export const PublicWidgetPage: React.FC = () => {
  const { embedKey = '' } = useParams();
  const [agentName, setAgentName] = useState('Assistant');
  const [orgName, setOrgName] = useState('');
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [input, setInput] = useState('');
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [error, setError] = useState('');
  const wsRef = useRef<ChatWebSocketClient | null>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const info = await api.initPublicWidget(embedKey);
        if (!mounted) return;
        setAgentName(info.agent_name);
        setOrgName(info.organization_name);

        const session = await api.startPublicWidgetSession(embedKey);
        if (!mounted) return;

        const client = new ChatWebSocketClient(
          session.conversation_id,
          (ev) => {
            if (ev.type === 'assistant_token' && ev.token) {
              setStreamingText((prev) => prev + ev.token);
            } else if (ev.type === 'assistant_complete') {
              setStreamingText('');
              setMessages((prev) => [
                ...prev,
                {
                  id: ev.message_id || String(Date.now()),
                  role: 'assistant',
                  content: ev.content || '',
                  citations: ev.citations || [],
                },
              ]);
            } else if (ev.type === 'error' && ev.detail) {
              setError(ev.detail);
            }
          },
          setWsStatus,
          session.widget_token,
        );
        wsRef.current = client;
        client.connect();
      } catch (err) {
        if (mounted) {
          setError(err instanceof FlowForgeApiError ? err.message : 'Unable to load chatbot widget.');
        }
      }
    }
    init();
    return () => {
      mounted = false;
      wsRef.current?.disconnect();
    };
  }, [embedKey]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !wsRef.current) return;
    setMessages((prev) => [...prev, { id: String(Date.now()), role: 'user', content: text }]);
    wsRef.current.sendMessage(text);
    setInput('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ff-bg-canvas)] p-3 sm:p-6">
      <div className="ff-card flex h-[calc(100vh-1.5rem)] max-h-[680px] w-full max-w-xl flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 bg-[var(--ff-bg-navy)] px-5 py-4 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ff-royal)] text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-sm font-semibold text-white">{agentName}</h1>
              <p className="truncate text-xs text-[var(--ff-text-on-navy-muted)]">{orgName || 'FlowForge AI'}</p>
            </div>
          </div>
          <StatusText
            status={wsStatus === 'connected' ? 'connected' : wsStatus === 'error' ? 'error' : 'pending'}
            label={wsStatus === 'connected' ? 'Live' : wsStatus}
          />
        </header>

        {error && (
          <div className="border-b border-[var(--ff-border)] p-3">
            <ErrorBanner message={error} onDismiss={() => setError('')} />
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 && !streamingText && (
            <div className="rounded-[var(--ff-radius-md)] border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] p-4 text-xs leading-relaxed text-[var(--ff-text-secondary)]">
              <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-[var(--ff-text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--ff-teal)]" />
                <span>Verified Knowledge Assistant</span>
              </div>
              Ask a question about our properties, pricing plans, or services. Every response is grounded in verified
              organization documents.
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[var(--ff-royal)] text-white'
                    : 'border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] text-[var(--ff-text-primary)]'
                }`}
              >
                {m.content}
              </div>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.citations.map((c) => (
                    <span
                      key={`${m.id}-${c.source_number}`}
                      className="ff-badge border-[var(--ff-border)] bg-[var(--ff-bg-surface)] text-[var(--ff-text-secondary)]"
                    >
                      <BookOpen className="h-3 w-3 text-[var(--ff-teal)]" />
                      <span>
                        [{c.source_number}] {c.document_title}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {streamingText && (
            <div className="flex flex-col items-start">
              <div className="max-w-[85%] rounded-xl border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] px-4 py-2.5 text-sm text-[var(--ff-text-primary)]">
                {streamingText}
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 border-t border-[var(--ff-border)] bg-[var(--ff-bg-surface)] p-3.5 sm:p-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="ff-input flex-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || wsStatus !== 'connected'}
            aria-label="Send message"
            className="ff-btn ff-btn-primary"
          >
            <Send className="h-4 w-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
