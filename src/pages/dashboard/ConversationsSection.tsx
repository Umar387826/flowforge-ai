import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, MessageSquare, Plus, Send } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { ChatWebSocketClient } from '../../api/ws';
import { useAuth } from '../../context/AuthContext';
import type { AIAgent, ChatMessage, Conversation } from '../../types/api';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';

export const ConversationsSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newAgentId, setNewAgentId] = useState('');
  const wsRef = useRef<ChatWebSocketClient | null>(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const [convRes, agentRes] = await Promise.all([api.listConversations(), api.listAgents()]);
      setConversations(convRes.results);
      setAgents(agentRes.results);
      if (agentRes.results.length > 0 && !newAgentId) setNewAgentId(agentRes.results[0].id);
      if (convRes.results.length > 0 && !selectedConv) setSelectedConv(convRes.results[0]);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadList();
  }, [activeOrg?.id]);

  useEffect(() => {
    if (!selectedConv) return;
    let active = true;

    api
      .getConversationMessages(selectedConv.id)
      .then((msgs) => {
        if (active) setMessages(msgs);
      })
      .catch((err) => {
        if (active) setError(err instanceof FlowForgeApiError ? err.message : 'Unable to fetch messages.');
      });

    wsRef.current?.disconnect();
    const client = new ChatWebSocketClient(
      selectedConv.id,
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
              token_usage: ev.token_usage || {},
              created_at: new Date().toISOString(),
            },
          ]);
        } else if (ev.type === 'error' && ev.detail) {
          setError(ev.detail);
        }
      },
      setWsStatus,
    );
    wsRef.current = client;
    client.connect();

    return () => {
      active = false;
      client.disconnect();
    };
  }, [selectedConv?.id]);

  const handleStartConversation = async () => {
    if (!newAgentId) {
      setError('Create an AI agent first.');
      return;
    }
    try {
      const conv = await api.createConversation({ agent: newAgentId, title: `Session ${conversations.length + 1}` });
      setConversations((prev) => [conv, ...prev]);
      setSelectedConv(conv);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to start conversation.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !selectedConv) return;
    setInput('');

    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: 'user',
        content: text,
        citations: [],
        token_usage: {},
        created_at: new Date().toISOString(),
      },
    ]);

    const sentViaWs = wsRef.current?.sendMessage(text);
    if (!sentViaWs) {
      try {
        const res = await api.sendMessageHttp(selectedConv.id, text);
        setMessages((prev) => [...prev.slice(0, -1), res.user_message, res.assistant_message]);
      } catch (err) {
        setError(err instanceof FlowForgeApiError ? err.message : 'Message delivery failed.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Conversations</h1>
          <p className="ff-page-subtitle">
            Real-time Django Channels WebSocket chat with streaming RAG responses and inline citations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select agent for new chat"
            value={newAgentId}
            onChange={(e) => setNewAgentId(e.target.value)}
            className="ff-select w-auto min-w-[160px]"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleStartConversation} className="ff-btn ff-btn-primary">
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Start a new real-time chat session with one of your organization's AI agents."
          actionLabel="Start First Chat"
          onAction={handleStartConversation}
        />
      ) : (
        <div className="ff-card grid min-h-[540px] grid-cols-1 overflow-hidden md:h-[640px] md:grid-cols-12">
          <div className="max-h-56 overflow-y-auto border-b border-[var(--ff-border)] md:col-span-4 md:max-h-none md:border-r md:border-b-0">
            <div className="border-b border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] px-4 py-2.5 text-xs font-semibold text-[var(--ff-text-secondary)]">
              Threads ({conversations.length})
            </div>
            {conversations.map((c) => {
              const active = selectedConv?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedConv(c)}
                  className={`w-full border-b border-[var(--ff-border)] px-4 py-3 text-left transition-colors ${
                    active ? 'bg-[var(--ff-royal-soft)]' : 'hover:bg-[var(--ff-bg-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare
                      className={`h-3.5 w-3.5 shrink-0 ${
                        active ? 'text-[var(--ff-royal-text)]' : 'text-[var(--ff-text-muted)]'
                      }`}
                    />
                    <span className="truncate text-sm font-semibold text-[var(--ff-text-primary)]">{c.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--ff-text-muted)]">
                    <span className="truncate">{c.agent_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{c.channel}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex min-h-[420px] flex-col md:col-span-8">
            {selectedConv ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] px-5 py-3">
                  <div>
                    <div className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">
                      {selectedConv.title}
                    </div>
                    <div className="text-xs text-[var(--ff-text-muted)]">Agent: {selectedConv.agent_name}</div>
                  </div>
                  <StatusText
                    status={wsStatus === 'connected' ? 'connected' : wsStatus === 'error' ? 'error' : 'pending'}
                    label={`WebSocket ${wsStatus}`}
                  />
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
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
                          {m.citations.map((cit) => (
                            <span
                              key={`${m.id}-${cit.source_number}`}
                              className="ff-badge border-[var(--ff-border)] bg-[var(--ff-bg-surface)] text-[var(--ff-text-secondary)]"
                            >
                              <BookOpen className="h-3 w-3 text-[var(--ff-teal)]" />
                              <span>
                                [{cit.source_number}] {cit.document_title}
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
                  className="flex items-center gap-2 border-t border-[var(--ff-border)] bg-[var(--ff-bg-surface)] p-4"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Send a message..."
                    className="ff-input flex-1"
                  />
                  <button type="submit" disabled={!input.trim()} className="ff-btn ff-btn-primary">
                    <Send className="h-4 w-4" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--ff-text-muted)]">
                Select a conversation to view history.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
