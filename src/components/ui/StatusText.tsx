import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';

interface StatusStyle {
  text: string;
  bg: string;
  border: string;
  Icon: React.FC<{ className?: string }>;
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  active: {
    text: 'text-[var(--ff-success)]',
    bg: 'bg-[var(--ff-success-soft)]',
    border: 'border-[rgba(5,150,105,0.25)]',
    Icon: CheckCircle2,
  },
  indexed: {
    text: 'text-[var(--ff-success)]',
    bg: 'bg-[var(--ff-success-soft)]',
    border: 'border-[rgba(5,150,105,0.25)]',
    Icon: CheckCircle2,
  },
  succeeded: {
    text: 'text-[var(--ff-success)]',
    bg: 'bg-[var(--ff-success-soft)]',
    border: 'border-[rgba(5,150,105,0.25)]',
    Icon: CheckCircle2,
  },
  connected: {
    text: 'text-[var(--ff-teal-text)]',
    bg: 'bg-[var(--ff-teal-soft)]',
    border: 'border-[rgba(13,148,136,0.25)]',
    Icon: CheckCircle2,
  },
  qualified: {
    text: 'text-[var(--ff-teal-text)]',
    bg: 'bg-[var(--ff-teal-soft)]',
    border: 'border-[rgba(13,148,136,0.25)]',
    Icon: CheckCircle2,
  },
  synced: {
    text: 'text-[var(--ff-royal-text)]',
    bg: 'bg-[var(--ff-royal-soft)]',
    border: 'border-[rgba(29,78,216,0.25)]',
    Icon: CheckCircle2,
  },
  success: {
    text: 'text-[var(--ff-success)]',
    bg: 'bg-[var(--ff-success-soft)]',
    border: 'border-[rgba(5,150,105,0.25)]',
    Icon: CheckCircle2,
  },
  pending: {
    text: 'text-[var(--ff-warning)]',
    bg: 'bg-[var(--ff-warning-soft)]',
    border: 'border-[rgba(217,119,6,0.25)]',
    Icon: Clock,
  },
  processing: {
    text: 'text-[var(--ff-warning)]',
    bg: 'bg-[var(--ff-warning-soft)]',
    border: 'border-[rgba(217,119,6,0.25)]',
    Icon: Clock,
  },
  running: {
    text: 'text-[var(--ff-royal-text)]',
    bg: 'bg-[var(--ff-royal-soft)]',
    border: 'border-[rgba(29,78,216,0.25)]',
    Icon: Clock,
  },
  new: {
    text: 'text-[var(--ff-text-secondary)]',
    bg: 'bg-[var(--ff-bg-subtle)]',
    border: 'border-[var(--ff-border)]',
    Icon: Clock,
  },
  past_due: {
    text: 'text-[var(--ff-warning)]',
    bg: 'bg-[var(--ff-warning-soft)]',
    border: 'border-[rgba(217,119,6,0.25)]',
    Icon: AlertTriangle,
  },
  skipped: {
    text: 'text-[var(--ff-text-muted)]',
    bg: 'bg-[var(--ff-bg-subtle)]',
    border: 'border-[var(--ff-border)]',
    Icon: AlertTriangle,
  },
  disconnected: {
    text: 'text-[var(--ff-text-muted)]',
    bg: 'bg-[var(--ff-bg-subtle)]',
    border: 'border-[var(--ff-border)]',
    Icon: AlertTriangle,
  },
  awaiting_credentials: {
    text: 'text-[var(--ff-warning)]',
    bg: 'bg-[var(--ff-warning-soft)]',
    border: 'border-[rgba(217,119,6,0.25)]',
    Icon: AlertTriangle,
  },
  failed: {
    text: 'text-[var(--ff-danger)]',
    bg: 'bg-[var(--ff-danger-soft)]',
    border: 'border-[rgba(220,38,38,0.25)]',
    Icon: XCircle,
  },
  error: {
    text: 'text-[var(--ff-danger)]',
    bg: 'bg-[var(--ff-danger-soft)]',
    border: 'border-[rgba(220,38,38,0.25)]',
    Icon: XCircle,
  },
  canceled: {
    text: 'text-[var(--ff-danger)]',
    bg: 'bg-[var(--ff-danger-soft)]',
    border: 'border-[rgba(220,38,38,0.25)]',
    Icon: XCircle,
  },
  disqualified: {
    text: 'text-[var(--ff-danger)]',
    bg: 'bg-[var(--ff-danger-soft)]',
    border: 'border-[rgba(220,38,38,0.25)]',
    Icon: XCircle,
  },
};

export const StatusText: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  const key = status.toLowerCase();
  const cfg = STATUS_STYLES[key] || {
    text: 'text-[var(--ff-text-secondary)]',
    bg: 'bg-[var(--ff-bg-subtle)]',
    border: 'border-[var(--ff-border)]',
    Icon: Clock,
  };
  const Icon = cfg.Icon;
  const text = label || status.replace(/_/g, ' ');

  return (
    <span className={`ff-badge capitalize ${cfg.text} ${cfg.bg} ${cfg.border}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </span>
  );
};
