export const PK_TIMEZONE = 'Asia/Karachi';

function toValidDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDatePK(value: string | number | Date | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PK_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  return `${day}-${month}-${year}`;
}

export function formatTimePK(value: string | number | Date | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateTimePK(value: string | number | Date | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return '—';
  return `${formatDatePK(date)} ${formatTimePK(date)} PKT`;
}

export function formatPKR(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString('en-PK')}`;
}
