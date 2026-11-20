import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { AuditLogItem } from '../../types/api';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../../components/ui/StateViews';
import { formatDateTimePK } from '../../utils/format';

export const AuditSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async (targetPage = page, q = search) => {
    setLoading(true);
    try {
      const res = await api.listAuditLogs(targetPage, q);
      setLogs(res.results);
      setCount(res.count);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadLogs(page, search);
  }, [activeOrg?.id, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLogs(1, search);
  };

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Audit &amp; Activity History</h1>
          <p className="ff-page-subtitle">
            Immutable organization-scoped trail of security, agent, billing, and integration events.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[var(--ff-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter action or correlation ID..."
              className="ff-input pl-9"
            />
          </div>
          <button type="submit" className="ff-btn ff-btn-primary">
            Filter
          </button>
        </form>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : logs.length === 0 ? (
        <EmptyState title="No audit events found" description="Administrative actions and mutations are logged here." />
      ) : (
        <div className="ff-table-wrap">
          <table className="ff-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Resource</th>
                <th>Correlation ID</th>
                <th className="text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="font-mono text-xs font-medium text-[var(--ff-text-primary)]">{log.action}</td>
                  <td className="text-xs text-[var(--ff-text-secondary)]">{log.actor_email || 'System'}</td>
                  <td className="text-xs text-[var(--ff-text-secondary)]">
                    {log.resource_type} {log.resource_id ? `(${log.resource_id.slice(0, 8)})` : ''}
                  </td>
                  <td className="font-mono text-xs text-[var(--ff-text-muted)]">
                    {log.correlation_id.slice(0, 12) || '—'}
                  </td>
                  <td className="text-right font-mono text-xs tabular-nums text-[var(--ff-text-muted)]">
                    {formatDateTimePK(log.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] px-4 py-3 text-xs text-[var(--ff-text-secondary)]">
            <span className="font-mono tabular-nums">Total events: {count}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="ff-btn ff-btn-secondary ff-btn-sm"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                disabled={logs.length < 20}
                onClick={() => setPage((p) => p + 1)}
                className="ff-btn ff-btn-secondary ff-btn-sm"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
