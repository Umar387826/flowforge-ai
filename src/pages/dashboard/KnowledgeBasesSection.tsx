import React, { useEffect, useState } from 'react';
import { Database, Plus, Search, Trash2, X } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { KnowledgeBase } from '../../types/api';
import { ConfirmDialog, EmptyState, ErrorBanner, LoadingSkeleton, SuccessBanner } from '../../components/ui/StateViews';

export const KnowledgeBasesSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [chunkSize, setChunkSize] = useState(800);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBase | null>(null);

  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [queryText, setQueryText] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ chunk_id: string; document_title: string; chunk_index: number; similarity: number; content: string }>
  >([]);
  const [searching, setSearching] = useState(false);

  const loadKbs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.listKnowledgeBases();
      setKbs(res.results);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load knowledge bases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadKbs();
  }, [activeOrg?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createKnowledgeBase({
        name: name.trim(),
        description: description.trim(),
        chunk_size: chunkSize,
      });
      setName('');
      setDescription('');
      setShowCreate(false);
      setNotice('Knowledge base created.');
      loadKbs();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to create knowledge base.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteKnowledgeBase(deleteTarget.id);
      setDeleteTarget(null);
      setNotice('Knowledge base deleted.');
      loadKbs();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Delete failed.');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKb || !queryText.trim()) return;
    setSearching(true);
    setError('');
    try {
      const res = await api.queryKnowledgeBase(selectedKb.id, queryText.trim());
      setSearchResults(res.results);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Vector similarity query failed.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Knowledge Bases</h1>
          <p className="ff-page-subtitle">
            PostgreSQL pgvector repositories scoped strictly to your organization.
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate((s) => !s)} className="ff-btn ff-btn-primary">
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{showCreate ? 'Close Form' : 'New Knowledge Base'}</span>
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="ff-card-padded space-y-4">
          <h2 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">
            Create Knowledge Base
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="kb-name" className="ff-label">
                Name
              </label>
              <input
                id="kb-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="DHA & Bahria Property Brochures"
                className="ff-input"
              />
            </div>
            <div>
              <label htmlFor="kb-chunk" className="ff-label">
                Chunk Size (chars)
              </label>
              <input
                id="kb-chunk"
                type="number"
                min="200"
                max="3000"
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value, 10) || 800)}
                className="ff-input font-mono tabular-nums"
              />
            </div>
          </div>
          <div>
            <label htmlFor="kb-desc" className="ff-label">
              Description
            </label>
            <input
              id="kb-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Payment schedules, plot maps, and commercial floor plans."
              className="ff-input"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--ff-border)] pt-4">
            <button type="button" onClick={() => setShowCreate(false)} className="ff-btn ff-btn-secondary">
              Cancel
            </button>
            <button type="submit" className="ff-btn ff-btn-primary">
              Create Knowledge Base
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : kbs.length === 0 ? (
        <EmptyState
          title="No knowledge bases yet"
          description="Create a knowledge base to organize uploaded PDF brochures and power RAG answers."
          actionLabel="Create Knowledge Base"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {kbs.map((kb) => (
            <div key={kb.id} className="ff-kpi-card flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--ff-teal-soft)] text-[var(--ff-teal-text)]">
                      <Database className="h-4 w-4" />
                    </div>
                    <h3 className="truncate font-display text-sm font-semibold text-[var(--ff-text-primary)]">
                      {kb.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(kb)}
                    aria-label={`Delete ${kb.name}`}
                    className="rounded p-1 text-[var(--ff-text-muted)] transition-colors hover:bg-[var(--ff-danger-soft)] hover:text-[var(--ff-danger)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-[var(--ff-text-muted)]">
                  {kb.description || 'No description provided'}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums text-[var(--ff-text-secondary)]">
                  <span>{kb.document_count} docs</span>
                  <span aria-hidden="true">·</span>
                  <span>{kb.chunk_count} vectors</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{kb.embedding_model}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedKb(kb);
                  setSearchResults([]);
                }}
                className="ff-btn ff-btn-secondary ff-btn-sm mt-5 w-full"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Test Vector Similarity Search</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedKb && (
        <div className="ff-card-padded space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--ff-border)] pb-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">
              pgvector Similarity Playground — {selectedKb.name}
            </h3>
            <button type="button" onClick={() => setSelectedKb(null)} className="ff-btn ff-btn-ghost ff-btn-sm">
              Close
            </button>
          </div>
          <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search indexed chunks (e.g. 10 marla installment plan)..."
              className="ff-input flex-1"
            />
            <button type="submit" disabled={searching} className="ff-btn ff-btn-primary">
              {searching ? 'Searching...' : 'Query Vectors'}
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="divide-y divide-[var(--ff-border)] rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] px-4">
              {searchResults.map((r) => (
                <div key={r.chunk_id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--ff-text-primary)]">
                      {r.document_title} · Chunk #{r.chunk_index}
                    </span>
                    <span className="font-mono tabular-nums text-[var(--ff-teal-text)]">
                      Similarity: {r.similarity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ff-text-secondary)]">{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Knowledge Base"
        description={`Delete "${deleteTarget?.name}" and all indexed vector chunks inside it?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
