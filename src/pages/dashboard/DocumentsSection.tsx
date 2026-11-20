import React, { useEffect, useState } from 'react';
import { FileText, RefreshCw, Trash2, Upload } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { DocumentItem, KnowledgeBase } from '../../types/api';
import { ConfirmDialog, EmptyState, ErrorBanner, LoadingSkeleton, SuccessBanner } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';

export const DocumentsSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [selectedKb, setSelectedKb] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [docRes, kbRes] = await Promise.all([api.listDocuments(), api.listKnowledgeBases()]);
      setDocs(docRes.results);
      setKbs(kbRes.results);
      if (kbRes.results.length > 0 && !selectedKb) {
        setSelectedKb(kbRes.results[0].id);
      }
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadAll();
  }, [activeOrg?.id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedKb) {
      setError('Create or select a Knowledge Base before uploading documents.');
      return;
    }
    if (!file) {
      setError('Select a PDF, TXT, MD, or CSV file to upload.');
      return;
    }
    const form = new FormData();
    form.append('knowledge_base', selectedKb);
    form.append('title', title.trim() || file.name);
    form.append('file', file);

    setUploading(true);
    try {
      await api.uploadDocument(form);
      setFile(null);
      setTitle('');
      setNotice('Document uploaded and queued in Celery for text extraction and pgvector embedding.');
      loadAll();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleReprocess = async (doc: DocumentItem) => {
    try {
      await api.reprocessDocument(doc.id);
      setNotice(`Re-queued "${doc.title}" for background indexing.`);
      loadAll();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Reprocess failed.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteDocument(deleteTarget.id);
      setDeleteTarget(null);
      setNotice('Document deleted.');
      loadAll();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Delete failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Documents</h1>
          <p className="ff-page-subtitle">
            Upload property brochures and documents for asynchronous Celery extraction, chunking, and vector indexing.
          </p>
        </div>
        <button type="button" onClick={loadAll} className="ff-btn ff-btn-secondary">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Status</span>
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      <form
        onSubmit={handleUpload}
        className="ff-card-padded grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:items-end"
      >
        <div>
          <label htmlFor="doc-kb" className="ff-label">
            Knowledge Base
          </label>
          <select id="doc-kb" value={selectedKb} onChange={(e) => setSelectedKb(e.target.value)} className="ff-select">
            {kbs.length === 0 ? (
              <option value="">No knowledge bases available</option>
            ) : (
              kbs.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label htmlFor="doc-title" className="ff-label">
            Document Title
          </label>
          <input
            id="doc-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional custom title"
            className="ff-input"
          />
        </div>
        <div>
          <label htmlFor="doc-file" className="ff-label">
            File (PDF, TXT, MD, CSV)
          </label>
          <input
            id="doc-file"
            type="file"
            accept=".pdf,.txt,.md,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="ff-input py-1.5 text-xs file:mr-3 file:rounded file:border file:border-[var(--ff-border)] file:bg-[var(--ff-bg-subtle)] file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-[var(--ff-text-primary)]"
          />
        </div>
        <button type="submit" disabled={uploading || !kbs.length} className="ff-btn ff-btn-primary w-full">
          <Upload className="h-4 w-4" />
          <span>{uploading ? 'Uploading...' : 'Upload & Index'}</span>
        </button>
      </form>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : docs.length === 0 ? (
        <EmptyState
          title="No documents uploaded"
          description="Upload your first PDF brochure or policy guide above to trigger Celery vector indexing."
        />
      ) : (
        <div className="ff-table-wrap">
          <table className="ff-table">
            <thead>
              <tr>
                <th>Document Title</th>
                <th>Knowledge Base</th>
                <th>Chunks</th>
                <th>Size</th>
                <th>Indexing Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-[var(--ff-royal-text)]" />
                      <div>
                        <div className="font-semibold text-[var(--ff-text-primary)]">{doc.title}</div>
                        {doc.error_message && <div className="mt-0.5 text-xs text-[var(--ff-danger)]">{doc.error_message}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="text-xs text-[var(--ff-text-secondary)]">{doc.knowledge_base_name}</td>
                  <td className="font-mono text-xs tabular-nums text-[var(--ff-text-primary)]">{doc.chunk_count}</td>
                  <td className="font-mono text-xs tabular-nums text-[var(--ff-text-muted)]">
                    {(doc.file_size / 1024).toFixed(1)} KB
                  </td>
                  <td>
                    <StatusText status={doc.status} />
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReprocess(doc)}
                        title="Reprocess via Celery"
                        aria-label={`Reprocess ${doc.title}`}
                        className="ff-btn ff-btn-secondary ff-btn-sm px-2"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(doc)}
                        title="Delete document"
                        aria-label={`Delete ${doc.title}`}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Document"
        description={`Delete "${deleteTarget?.title}" and remove its pgvector embeddings?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
