import React, { useState } from 'react';

export interface BarDatum {
  label: string;
  value: number;
  max?: number;
  hint?: string;
  tone?: 'royal' | 'teal' | 'navy' | 'amber';
}

const TONE_COLOR: Record<NonNullable<BarDatum['tone']>, string> = {
  royal: 'var(--ff-royal)',
  teal: 'var(--ff-teal)',
  navy: '#334155',
  amber: 'var(--ff-warning)',
};

export const HorizontalMetricChart: React.FC<{
  title: string;
  subtitle?: string;
  items: BarDatum[];
}> = ({ title, subtitle, items }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const highestVal = Math.max(1, ...items.map((i) => i.max || i.value));

  return (
    <div className="ff-card-padded flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--ff-text-muted)]">{subtitle}</p>}
          </div>
          {hoveredIdx !== null && items[hoveredIdx] && (
            <div
              role="status"
              className="rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] px-2.5 py-1 font-mono text-xs tabular-nums text-[var(--ff-text-primary)]"
            >
              {items[hoveredIdx].label}: {items[hoveredIdx].value.toLocaleString()}
              {items[hoveredIdx].max ? ` / ${items[hoveredIdx].max?.toLocaleString()}` : ''}
            </div>
          )}
        </div>

        <div className="mt-5 space-y-4">
          {items.map((item, idx) => {
            const denom = item.max && item.max > 0 ? item.max : highestVal;
            const pct = Math.min(100, Math.round((item.value / denom) * 100));
            const color = TONE_COLOR[item.tone || 'royal'];

            return (
              <div
                key={item.label}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="group rounded-md p-1 -mx-1 transition-colors hover:bg-[var(--ff-bg-subtle)]"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[var(--ff-text-secondary)]">{item.label}</span>
                  <span className="font-mono tabular-nums text-[var(--ff-text-primary)]">
                    {item.value.toLocaleString()}
                    {item.max ? (
                      <span className="text-[var(--ff-text-muted)]"> / {item.max.toLocaleString()} ({pct}%)</span>
                    ) : null}
                  </span>
                </div>
                <div className="ff-progress-track mt-1.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={item.label}>
                  <div
                    className="ff-progress-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                {item.hint && <p className="mt-1 text-[11px] text-[var(--ff-text-muted)]">{item.hint}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface ColumnBarDatum {
  label: string;
  value: number;
  tone?: 'royal' | 'teal' | 'amber';
}

export const VerticalColumnChart: React.FC<{
  title: string;
  subtitle?: string;
  data: ColumnBarDatum[];
}> = ({ title, subtitle, data }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maxVal = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="ff-card-padded flex flex-col justify-between">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--ff-text-muted)]">{subtitle}</p>}
        </div>
        {activeIndex !== null && data[activeIndex] && (
          <span className="rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] px-2.5 py-1 font-mono text-xs tabular-nums text-[var(--ff-text-primary)]">
            {data[activeIndex].label}: {data[activeIndex].value.toLocaleString()}
          </span>
        )}
      </div>

      <div className="mt-5">
        <svg viewBox="0 0 420 175" className="h-44 w-full overflow-visible" role="img" aria-label={title}>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = 132 - tick * 108;
            return (
              <g key={tick}>
                <line
                  x1="36"
                  y1={y}
                  x2="412"
                  y2={y}
                  stroke="var(--ff-border)"
                  strokeDasharray={tick === 0 ? undefined : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x="30"
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--ff-text-muted)"
                  fontSize="9.5"
                  fontFamily="var(--font-mono)"
                >
                  {Math.round(maxVal * tick)}
                </text>
              </g>
            );
          })}

          {data.map((d, idx) => {
            const slotWidth = 372 / Math.max(1, data.length);
            const barWidth = Math.min(44, slotWidth * 0.56);
            const x = 40 + idx * slotWidth + (slotWidth - barWidth) / 2;
            const barHeight = d.value > 0 ? Math.max(4, (d.value / maxVal) * 108) : 2;
            const y = 132 - barHeight;
            const fill =
              d.tone === 'teal'
                ? 'var(--ff-teal)'
                : d.tone === 'amber'
                  ? 'var(--ff-warning)'
                  : 'var(--ff-royal)';

            return (
              <g
                key={d.label}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={fill}
                  opacity={activeIndex === null || activeIndex === idx ? 0.92 : 0.45}
                />
                <text
                  x={x + barWidth / 2}
                  y={152}
                  textAnchor="middle"
                  fill="var(--ff-text-secondary)"
                  fontSize="10"
                  fontFamily="var(--font-sans)"
                >
                  {d.label}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fill="var(--ff-text-primary)"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                >
                  {d.value.toLocaleString()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export const DonutSummaryChart: React.FC<{
  title: string;
  subtitle?: string;
  centerLabel: string;
  segments: DonutSegment[];
}> = ({ title, subtitle, centerLabel, segments }) => {
  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="ff-card-padded flex flex-col justify-between">
      <div>
        <h3 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--ff-text-muted)]">{subtitle}</p>}
      </div>

      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={title}>
            <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--ff-bg-subtle)" strokeWidth="14" />
            {total > 0 &&
              segments.map((seg, idx) => {
                const fraction = seg.value / total;
                const dash = fraction * circumference;
                const offset = -cumulative * circumference;
                cumulative += fraction;
                return (
                  <circle
                    key={seg.label}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={hoverSeg === idx ? '16' : '14'}
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={offset}
                    onMouseEnter={() => setHoverSeg(idx)}
                    onMouseLeave={() => setHoverSeg(null)}
                    className="cursor-pointer transition-all duration-150"
                  />
                );
              })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-lg font-bold tabular-nums text-[var(--ff-text-primary)]">
              {hoverSeg !== null && segments[hoverSeg] ? segments[hoverSeg].value.toLocaleString() : total.toLocaleString()}
            </span>
            <span className="text-[10px] font-medium text-[var(--ff-text-muted)]">
              {hoverSeg !== null && segments[hoverSeg] ? segments[hoverSeg].label : centerLabel}
            </span>
          </div>
        </div>

        <div className="w-full flex-1 space-y-2.5">
          {segments.map((seg, idx) => {
            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
            return (
              <div
                key={seg.label}
                onMouseEnter={() => setHoverSeg(idx)}
                onMouseLeave={() => setHoverSeg(null)}
                className="flex items-center justify-between rounded-md px-2 py-1 text-xs transition-colors hover:bg-[var(--ff-bg-subtle)]"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-[var(--ff-text-secondary)]">{seg.label}</span>
                </div>
                <span className="font-mono tabular-nums text-[var(--ff-text-primary)]">
                  {seg.value.toLocaleString()} <span className="text-[var(--ff-text-muted)]">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
