// Lightweight SVG charts — no external chart library. Every component keeps its
// own aspect ratio via viewBox so they scale into any grid cell cleanly.

import { useMemo } from 'react';

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export function BarChart({
  data,
  height = 220,
  unit = '',
  ariaLabel,
}: {
  data: BarDatum[];
  height?: number;
  unit?: string;
  ariaLabel?: string;
}) {
  const width = 640;
  const padding = { top: 20, right: 24, bottom: 42, left: 60 };
  const innerH = height - padding.top - padding.bottom;
  const innerW = width - padding.left - padding.right;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = innerW / Math.max(1, data.length) - 12;

  if (data.length === 0) {
    return <div className="cbz-chart-empty">No data yet</div>;
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      className="cbz-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? 'Bar chart'}
    >
      {gridLines.map((g) => {
        const y = padding.top + innerH * (1 - g);
        return (
          <g key={g}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="cbz-chart__grid" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="cbz-chart__axis">
              {formatShort(max * g)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = padding.left + i * (innerW / data.length) + 6;
        const h = (d.value / max) * innerH;
        const y = padding.top + innerH - h;
        return (
          <g key={`${d.label}-${i}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={4}
              fill={d.color ?? 'var(--cbz-brand)'}
              className="cbz-chart__bar"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <title>{`${d.label}: ${d.value.toLocaleString()} ${unit}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={height - padding.bottom + 16}
              textAnchor="middle"
              className="cbz-chart__axis"
            >
              {d.label.length > 12 ? `${d.label.slice(0, 12)}…` : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({
  historical,
  forecast,
  labels,
  unit,
  ariaLabel,
  height = 240,
}: {
  historical: number[];
  forecast?: number[];
  labels: string[];
  unit?: string;
  ariaLabel?: string;
  height?: number;
}) {
  const width = 720;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };
  const innerH = height - padding.top - padding.bottom;
  const innerW = width - padding.left - padding.right;
  const values = [...historical, ...(forecast ?? [])];
  const max = Math.max(1, ...values) * 1.1;
  const min = Math.min(0, ...values) * 1.0;
  const range = max - min || 1;
  const step = innerW / Math.max(1, values.length - 1);

  const pointsHist = historical
    .map((v, i) => `${padding.left + i * step},${padding.top + innerH * (1 - (v - min) / range)}`)
    .join(' ');
  const pointsFore = forecast
    ? [historical[historical.length - 1], ...forecast]
        .map((v, i) => {
          const x = padding.left + (historical.length - 1 + i) * step;
          const y = padding.top + innerH * (1 - (v - min) / range);
          return `${x},${y}`;
        })
        .join(' ')
    : '';

  return (
    <svg
      className="cbz-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? 'Line chart'}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((g) => {
        const y = padding.top + innerH * (1 - g);
        return (
          <g key={g}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="cbz-chart__grid" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="cbz-chart__axis">
              {formatShort(min + range * g)}
            </text>
          </g>
        );
      })}
      <polyline points={pointsHist} className="cbz-chart__line" />
      {historical.map((v, i) => (
        <circle
          key={`h-${i}`}
          cx={padding.left + i * step}
          cy={padding.top + innerH * (1 - (v - min) / range)}
          r={4}
          className="cbz-chart__dot"
        >
          <title>{`${labels[i]}: ${v.toLocaleString()} ${unit ?? ''}`}</title>
        </circle>
      ))}
      {pointsFore && (
        <polyline points={pointsFore} className="cbz-chart__line cbz-chart__line--forecast" />
      )}
      {forecast?.map((v, i) => (
        <circle
          key={`f-${i}`}
          cx={padding.left + (historical.length + i) * step}
          cy={padding.top + innerH * (1 - (v - min) / range)}
          r={4}
          className="cbz-chart__dot cbz-chart__dot--forecast"
        >
          <title>{`${labels[historical.length + i]}: ${v.toLocaleString()} (forecast)`}</title>
        </circle>
      ))}
      {labels.map((l, i) => (
        <text
          key={l}
          x={padding.left + i * step}
          y={height - padding.bottom + 18}
          textAnchor="middle"
          className="cbz-chart__axis"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

export interface DoughnutSegment {
  label: string;
  value: number;
  color: string;
}

export function DoughnutChart({
  segments,
  centerLabel,
  centerValue,
  size = 200,
}: {
  segments: DoughnutSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = size / 2 - 6;
  const inner = radius * 0.62;
  let angleFrom = -Math.PI / 2;

  const arcs = segments.map((seg) => {
    const share = seg.value / total;
    const angleTo = angleFrom + share * Math.PI * 2;
    const large = share > 0.5 ? 1 : 0;
    const x1 = size / 2 + radius * Math.cos(angleFrom);
    const y1 = size / 2 + radius * Math.sin(angleFrom);
    const x2 = size / 2 + radius * Math.cos(angleTo);
    const y2 = size / 2 + radius * Math.sin(angleTo);
    const x3 = size / 2 + inner * Math.cos(angleTo);
    const y3 = size / 2 + inner * Math.sin(angleTo);
    const x4 = size / 2 + inner * Math.cos(angleFrom);
    const y4 = size / 2 + inner * Math.sin(angleFrom);
    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');
    const arc = { path, seg, share };
    angleFrom = angleTo;
    return arc;
  });

  return (
    <div className="cbz-doughnut" style={{ width: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {arcs.map((arc) => (
          <path key={arc.seg.label} d={arc.path} fill={arc.seg.color}>
            <title>{`${arc.seg.label}: ${arc.seg.value.toLocaleString()} (${(arc.share * 100).toFixed(1)}%)`}</title>
          </path>
        ))}
        {centerValue && (
          <text x={size / 2} y={size / 2 + 2} textAnchor="middle" className="cbz-doughnut__value">
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={size / 2} y={size / 2 + 22} textAnchor="middle" className="cbz-doughnut__label">
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="cbz-doughnut__legend">
        {segments.map((seg) => (
          <li key={seg.label}>
            <span className="cbz-doughnut__swatch" style={{ background: seg.color }} />
            <span className="cbz-doughnut__legend-label">{seg.label}</span>
            <span className="cbz-doughnut__legend-value">{formatShort(seg.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StackedBar({
  segments,
  ariaLabel,
}: {
  segments: DoughnutSegment[];
  ariaLabel?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <div className="cbz-stacked" role="img" aria-label={ariaLabel}>
      {segments.map((s) => (
        <div
          key={s.label}
          className="cbz-stacked__bar"
          style={{ flexBasis: `${(s.value / total) * 100}%`, background: s.color }}
          title={`${s.label}: ${s.value.toLocaleString()} (${((s.value / total) * 100).toFixed(1)}%)`}
        />
      ))}
    </div>
  );
}

export function formatShort(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (abs >= 10) return value.toFixed(0);
  return value.toFixed(2);
}

export function useSeries<T>(data: T[], selector: (t: T) => number): number[] {
  return useMemo(() => data.map(selector), [data, selector]);
}
