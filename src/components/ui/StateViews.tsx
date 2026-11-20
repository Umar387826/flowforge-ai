import React from 'react';
import { AlertCircle, CheckCircle2, Inbox, X } from 'lucide-react';

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading content">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="h-12 w-full animate-pulse rounded-[var(--ff-radius-md)] border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)]"
      />
    ))}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="ff-card flex flex-col items-center justify-center px-6 py-12 text-center">
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] text-[var(--ff-text-muted)]">
      <Inbox className="h-5 w-5" />
    </div>
    <h3 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-[var(--ff-text-muted)]">{description}</p>
    {actionLabel && onAction && (
      <button type="button" onClick={onAction} className="ff-btn ff-btn-primary mt-5">
        {actionLabel}
      </button>
    )}
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onDismiss?: () => void }> = ({ message, onDismiss }) => (
  <div
    role="alert"
    className="flex items-start justify-between gap-3 rounded-[var(--ff-radius-md)] border border-[rgba(220,38,38,0.3)] bg-[var(--ff-danger-soft)] px-4 py-3 text-sm text-[var(--ff-danger)]"
  >
    <div className="flex items-start gap-2.5">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="rounded p-0.5 text-[var(--ff-danger)] opacity-80 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

export const SuccessBanner: React.FC<{ message: string; onDismiss?: () => void }> = ({ message, onDismiss }) => (
  <div
    role="status"
    className="flex items-center justify-between gap-3 rounded-[var(--ff-radius-md)] border border-[rgba(5,150,105,0.3)] bg-[var(--ff-success-soft)] px-4 py-3 text-sm text-[var(--ff-success)]"
  >
    <div className="flex items-center gap-2.5">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notice"
        className="rounded p-0.5 text-[var(--ff-success)] opacity-80 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, description, confirmLabel = 'Delete', onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="ff-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="ff-modal-panel">
        <h3 id="confirm-dialog-title" className="font-display text-base font-semibold text-[var(--ff-text-primary)]">
          {title}
        </h3>
        <p className="mt-2 text-sm text-[var(--ff-text-secondary)]">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="ff-btn ff-btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="ff-btn ff-btn-danger">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
