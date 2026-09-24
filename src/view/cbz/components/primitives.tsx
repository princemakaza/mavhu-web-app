// Small presentational primitives used across every tab.
// Kept in one file so we can enforce a consistent visual language everywhere.

import type { ReactNode } from 'react';
import type { EmissionRecord, RiskEntry } from '../../../model/cbz/types';

export function StatCard({
  label,
  value,
  unit,
  hint,
  trend,
  intent,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  trend?: { direction: 'up' | 'down' | 'flat'; delta: string };
  intent?: 'neutral' | 'positive' | 'negative' | 'warning';
}) {
  return (
    <div className={`cbz-stat cbz-stat--${intent ?? 'neutral'}`}>
      <div className="cbz-stat__label">{label}</div>
      <div className="cbz-stat__value">
        {value}
        {unit && <span className="cbz-stat__unit">{unit}</span>}
      </div>
      {(trend || hint) && (
        <div className="cbz-stat__meta">
          {trend && (
            <span className={`cbz-trend cbz-trend--${trend.direction}`}>
              {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '■'} {trend.delta}
            </span>
          )}
          {hint && <span className="cbz-stat__hint">{hint}</span>}
        </div>
      )}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  subtitle,
  padded = true,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="cbz-panel">
      {(title || action) && (
        <header className="cbz-panel__head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="cbz-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'cbz-panel__body' : 'cbz-panel__body cbz-panel__body--flush'}>{children}</div>
    </section>
  );
}

export function StatusBadge({ status }: { status: EmissionRecord['status'] }) {
  const label = status.replace('_', ' ');
  return <span className={`cbz-badge cbz-badge--status-${status}`}>{label}</span>;
}

export function DqPill({ score }: { score: number }) {
  const rounded = Math.round(score);
  return <span className={`cbz-pill cbz-pill--dq cbz-pill--dq-${rounded}`}>DQ {score.toFixed(1)}</span>;
}

export function RiskChip({ category }: { category: RiskEntry['category'] }) {
  return <span className={`cbz-chip cbz-chip--risk-${category.toLowerCase()}`}>{category}</span>;
}

export function fmtUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function fmtT(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(digits)}k`;
  return value.toFixed(digits);
}

export function fmtPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="cbz-empty">
      <div className="cbz-empty__mark">∅</div>
      <div className="cbz-empty__title">{title}</div>
      {hint && <div className="cbz-empty__hint">{hint}</div>}
    </div>
  );
}
