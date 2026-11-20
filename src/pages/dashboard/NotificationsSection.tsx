import React, { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, RefreshCw } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { NotificationItem } from '../../types/api';
import { EmptyState, ErrorBanner, LoadingSkeleton, SuccessBanner } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';
import { formatDateTimePK } from '../../utils/format';

export const NotificationsSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.listNotifications();
      setItems(res.results);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load workspace notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadNotifications();
  }, [activeOrg?.id]);

  const handleMarkRead = async (item: NotificationItem) => {
    try {
      const updated = await api.markNotificationRead(item.id);
      setItems((prev) => prev.map((n) => (n.id === item.id ? updated : n)));
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to mark notification as read.');
    }
  };

  const handleMarkAllRead = async () => {
    const unread = items.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    setMarkingAll(true);
    setError('');
    try {
      await Promise.all(unread.map((n) => api.markNotificationRead(n.id)));
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setNotice(`Marked ${unread.length} notification${unread.length === 1 ? '' : 's'} as read.`);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to update notifications.');
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = items.filter((n) => !n.is_read).length;
  const visibleItems = filter === 'unread' ? items.filter((n) => !n.is_read) : items;

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Notifications</h1>
          <p className="ff-page-subtitle">
            Real-time workflow alerts, document indexing status updates, and CRM synchronization notices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="ff-segmented" role="tablist" aria-label="Filter notifications">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              onClick={() => setFilter('all')}
              className={`ff-segmented-btn ${filter === 'all' ? 'ff-segmented-btn-active' : ''}`}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'unread'}
              onClick={() => setFilter('unread')}
              className={`ff-segmented-btn ${filter === 'unread' ? 'ff-segmented-btn-active' : ''}`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            className="ff-btn ff-btn-secondary ff-btn-sm"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>Mark all read</span>
          </button>

          <button type="button" onClick={loadNotifications} className="ff-btn ff-btn-secondary ff-btn-sm">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description={
            filter === 'unread'
              ? 'All workspace alerts have been acknowledged.'
              : 'Workflow alerts, document indexing confirmations, and lead events will appear here.'
          }
        />
      ) : (
        <div className="ff-card divide-y divide-[var(--ff-border)] overflow-hidden">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:px-6 ${
                !item.is_read ? 'bg-[var(--ff-royal-soft)]' : ''
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg-surface)] text-[var(--ff-royal-text)]">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-[var(--ff-text-primary)]">{item.title}</h2>
                    <StatusText status={item.level === 'info' ? 'synced' : item.level} label={item.level} />
                    {!item.is_read && (
                      <span className="ff-badge border-[rgba(29,78,216,0.25)] bg-[var(--ff-bg-surface)] text-[var(--ff-royal-text)]">
                        Unread
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ff-text-secondary)]">{item.message}</p>
                  <p className="mt-1 font-mono text-[11px] tabular-nums text-[var(--ff-text-muted)]">
                    {formatDateTimePK(item.created_at)}
                  </p>
                </div>
              </div>

              {!item.is_read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(item)}
                  className="ff-btn ff-btn-secondary ff-btn-sm self-start sm:self-center"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Mark Read</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
