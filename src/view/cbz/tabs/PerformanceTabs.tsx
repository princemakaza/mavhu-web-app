// Targets & KPIs (F21/F46), risk appetite (F31) and decarbonisation programmes (F35).
import { useMemo, useState } from 'react';
import { apiCreateRegisterItem } from '../../../model/cbz/cbz_api';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import { LIVE_METRIC_LABELS, latestApprovedPeriod, liveMetric } from '../../../model/cbz/metrics';
import type { EntityCode, RegisterItem } from '../../../model/cbz/types';
import { Panel, ProgressBar, RagChip, StatCard, MethodNote } from '../components/primitives';
import { RegisterView } from '../components/RegisterView';

const isShare = (unit: unknown) => String(unit).includes('%') || unit === 'share';
const fmt = (v: number | null, unit: unknown) => (v === null ? '—' : isShare(unit) ? `${(v * 100).toFixed(1)}%` : v.toLocaleString('en-GB', { maximumFractionDigits: 2 }));

// ── Targets & KPIs ──────────────────────────────────────────────────────────

export function TargetsTab({ scope }: { scope: EntityCode }) {
  const { state } = useCbzData();
  const latest = latestApprovedPeriod(state);
  const nowYear = latest ? Number(latest.slice(0, 4)) + Number(latest.slice(5, 7)) / 12 : new Date().getFullYear();

  const progressOf = (t: RegisterItem) => {
    const d = t.data;
    const current = d.metricCode === 'MANUAL' ? (typeof d.currentValue === 'number' ? d.currentValue : null) : liveMetric(String(d.metricCode), state, (t.entityCode ?? 'GROUP') as EntityCode);
    const base = Number(d.baselineValue);
    const target = Number(d.targetValue);
    if (current === null || !Number.isFinite(base) || !Number.isFinite(target) || base === target) return { current, progress: null, expected: null, onTrack: null as boolean | null };
    const progress = (current - base) / (target - base);
    const span = Number(d.targetYear) - Number(d.baselineYear);
    const expected = span > 0 ? Math.min(1, Math.max(0, (nowYear - Number(d.baselineYear) - 1) / span)) : 1;
    return { current, progress, expected, onTrack: progress >= expected - 0.02 };
  };

  // Year-on-year variation (F46): the latest year to date against the same months a year earlier.
  const variation = useMemo(() => {
    const monthly = state.emissions.filter(
      (e) => ['approved', 'locked'].includes(e.status) && /^\d{4}-\d{2}$/.test(e.period) && (scope === 'GROUP' || e.entityCode === scope),
    );
    const latestYear = monthly.map((e) => e.period.slice(0, 4)).sort().pop();
    if (!latestYear) return null;
    const months = new Set(monthly.filter((e) => e.period.startsWith(latestYear)).map((e) => e.period.slice(5)));
    const prior = String(Number(latestYear) - 1);
    const sumFor = (year: string, sc: string) => {
      const rows = monthly.filter((e) => e.scope === sc && e.period.startsWith(year) && months.has(e.period.slice(5)));
      return rows.length ? rows.reduce((t, e) => t + Number(e.emissionsTco2e), 0) : null;
    };
    const span = [...months].sort();
    return {
      label: `${latestYear} months ${span[0]}–${span[span.length - 1]}`,
      years: [prior, latestYear],
      rows: [
        { label: 'Scope 1 (direct)', a: sumFor(prior, 'scope1'), b: sumFor(latestYear, 'scope1') },
        { label: 'Scope 2 (energy, location-based)', a: sumFor(prior, 'scope2'), b: sumFor(latestYear, 'scope2') },
        { label: 'Scope 3 (operational)', a: sumFor(prior, 'scope3'), b: sumFor(latestYear, 'scope3') },
      ],
    };
  }, [state.emissions, scope]);

  return (
    <>
      <RegisterView
        register="targets"
        title="Targets"
        subtitle="Progress is measured live from approved data against a straight-line path from baseline to target (IFRS S2 §33-36, F21)."
        scope={scope}
        defaults={{ direction: 'reduce', metricCode: 'SCOPE12_TCO2E', unit: 'tCO2e', baselineYear: 2024, targetYear: 2030 }}
        columns={[
          { key: 'name', label: 'Target' },
          { key: 'metricCode', label: 'Measured by', render: (t) => LIVE_METRIC_LABELS[String(t.data.metricCode)] ?? String(t.data.metricCode) },
          { key: 'baseline', label: 'Baseline', render: (t) => `${fmt(Number(t.data.baselineValue), t.data.unit)} (${t.data.baselineYear})` },
          { key: 'current', label: 'Current', render: (t) => <strong>{fmt(progressOf(t).current, t.data.unit)}</strong> },
          { key: 'target', label: 'Target', render: (t) => `${fmt(Number(t.data.targetValue), t.data.unit)} (${t.data.targetYear})` },
          {
            key: 'progress',
            label: 'Progress',
            render: (t) => {
              const p = progressOf(t);
              if (p.progress === null) return <span className="cbz-muted">Not measurable yet</span>;
              return <ProgressBar value={p.progress} tone={p.onTrack ? 'green' : 'amber'} label={`${Math.round(p.progress * 100)}% (path ${Math.round((p.expected ?? 0) * 100)}%)`} />;
            },
          },
          {
            key: 'status',
            label: 'Status',
            render: (t) => {
              const p = progressOf(t);
              if (p.progress === null) return <RagChip status="grey" label="No data" />;
              if (p.progress >= 1) return <RagChip status="green" label="Achieved" />;
              return p.onTrack ? <RagChip status="green" label="On track" /> : <RagChip status="amber" label="Behind path" />;
            },
          },
          { key: 'owner', label: 'Owner' },
        ]}
      />
      <Panel
        title="KPI variation"
        subtitle={variation ? `Approved operational emissions, ${variation.label} against the same months of ${variation.years[0]} (F46).` : 'Needs approved monthly data.'}
        padded={false}
      >
        {variation && (
          <div className="cbz-table-wrap">
            <table className="cbz-table">
              <thead>
                <tr>
                  <th>KPI (tCO2e)</th>
                  <th className="cbz-num">{variation.years[0]} same months</th>
                  <th className="cbz-num">{variation.years[1]} to date</th>
                  <th className="cbz-num">Variation</th>
                </tr>
              </thead>
              <tbody>
                {variation.rows.map((r) => {
                  const change = r.a && r.b !== null ? (r.b - r.a) / r.a : null;
                  return (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="cbz-num">{r.a === null ? '—' : r.a.toLocaleString('en-GB', { maximumFractionDigits: 1 })}</td>
                      <td className="cbz-num">{r.b === null ? '—' : r.b.toLocaleString('en-GB', { maximumFractionDigits: 1 })}</td>
                      <td className="cbz-num">
                        {change === null ? '—' : <span className={change <= 0 ? 'cbz-good' : 'cbz-bad'}>{`${change > 0 ? '+' : ''}${(change * 100).toFixed(1)}%`}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <MethodNote>{latest ? `Latest approved period: ${latest}. Like-for-like months only, so seasonality does not distort the change.` : 'No approved data yet.'}</MethodNote>
      </Panel>
    </>
  );
}

// ── Risk appetite ───────────────────────────────────────────────────────────

export function AppetiteTab() {
  const { state, can, me } = useCbzData();
  const [escalationsKey, setEscalationsKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const statusOf = (item: RegisterItem) => {
    const d = item.data;
    const value = d.metricCode === 'MANUAL' ? (typeof d.currentValue === 'number' ? d.currentValue : null) : liveMetric(String(d.metricCode), state);
    if (value === null) return { value, rag: 'grey' as const, label: 'No data' };
    const max = d.direction !== 'min';
    const breach = max ? value > Number(d.limit) : value < Number(d.limit);
    const warn = max ? value > Number(d.warning) : value < Number(d.warning);
    return breach ? { value, rag: 'red' as const, label: 'Limit breached' } : warn ? { value, rag: 'amber' as const, label: 'Above warning' } : { value, rag: 'green' as const, label: 'Within appetite' };
  };

  async function escalate(item: RegisterItem) {
    const s = statusOf(item);
    setError(null);
    try {
      await apiCreateRegisterItem('escalations', {
        data: {
          metric: item.data.metric,
          value: Math.round((s.value ?? 0) * 1000) / 1000,
          limit: item.data.limit,
          raisedBy: me?.actorName ?? 'Unknown',
          raisedAt: new Date().toISOString().slice(0, 10),
          status: 'Open',
          note: `${s.label}: escalated to ${item.data.escalateTo}`,
        },
      });
      setEscalationsKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not escalate');
    }
  }

  return (
    <>
      {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
      <RegisterView
        register="risk-appetite"
        title="Climate risk appetite"
        subtitle="Each metric is measured live; crossing the warning or limit lights up and can be escalated to its committee (F31)."
        defaults={{ direction: 'max', metricCode: 'FINANCED_INTENSITY' }}
        columns={[
          { key: 'metric', label: 'Appetite metric' },
          { key: 'current', label: 'Current', render: (i) => <strong>{fmt(statusOf(i).value, i.data.unit)}</strong> },
          { key: 'warning', label: 'Warning', render: (i) => fmt(Number(i.data.warning), i.data.unit) },
          { key: 'limit', label: 'Limit', render: (i) => fmt(Number(i.data.limit), i.data.unit) },
          { key: 'rag', label: 'Status', render: (i) => <RagChip status={statusOf(i).rag} label={statusOf(i).label} /> },
          { key: 'escalateTo', label: 'Escalates to' },
        ]}
        rowActions={(i) =>
          can('operational-registers') && ['red', 'amber'].includes(statusOf(i).rag) ? (
            <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--danger" onClick={() => escalate(i)}>
              Escalate
            </button>
          ) : null
        }
      />
      <RegisterView
        key={escalationsKey}
        register="escalations"
        title="Escalations"
        subtitle="Raised when a metric crosses appetite; closed by the committee it went to."
        columns={[
          { key: 'raisedAt', label: 'Raised' },
          { key: 'metric', label: 'Metric' },
          { key: 'value', label: 'Value', numeric: true },
          { key: 'limit', label: 'Limit', numeric: true },
          { key: 'raisedBy', label: 'Raised by' },
          { key: 'status', label: 'Status', render: (i) => <RagChip status={i.data.status === 'Closed' ? 'green' : i.data.status === 'Actioned' ? 'amber' : 'red'} label={String(i.data.status)} /> },
          { key: 'note', label: 'Note' },
        ]}
      />
    </>
  );
}

// ── Decarbonisation programmes ──────────────────────────────────────────────

export function DecarbonisationTab({ scope }: { scope: EntityCode }) {
  return (
    <RegisterView
      register="decarbonisation"
      title="Decarbonisation & transition programmes"
      subtitle="Programme → initiative → next milestone, with expected annual reduction (F35)."
      scope={scope}
      defaults={{ status: 'Planned' }}
      header={(items) => {
        const sum = (s?: string) => items.filter((i) => !s || i.data.status === s).reduce((t, i) => t + Number(i.data.expectedReductionTco2e ?? 0), 0);
        const atRisk = items.filter((i) => i.data.status === 'At risk' || (i.data.status !== 'Done' && String(i.data.dueDate) < new Date().toISOString().slice(0, 10))).length;
        return (
          <div className="cbz-grid cbz-grid--stats">
            <StatCard label="Initiatives" value={String(items.length)} hint={`${new Set(items.map((i) => i.data.programme)).size} programmes`} />
            <StatCard label="Delivered reduction" value={sum('Done').toLocaleString('en-GB')} unit="tCO2e/yr" intent="positive" />
            <StatCard label="Pipeline reduction" value={(sum() - sum('Done')).toLocaleString('en-GB')} unit="tCO2e/yr" />
            <StatCard label="At risk or overdue" value={String(atRisk)} intent={atRisk ? 'warning' : 'neutral'} />
          </div>
        );
      }}
      columns={[
        { key: 'programme', label: 'Programme' },
        { key: 'initiative', label: 'Initiative' },
        { key: 'milestone', label: 'Next milestone' },
        { key: 'dueDate', label: 'Due' },
        { key: 'status', label: 'Status', render: (i) => <RagChip status={i.data.status === 'Done' ? 'green' : i.data.status === 'At risk' ? 'red' : i.data.status === 'In progress' ? 'amber' : 'grey'} label={String(i.data.status)} /> },
        { key: 'expectedReductionTco2e', label: 'tCO2e/yr', numeric: true },
        { key: 'owner', label: 'Owner' },
      ]}
    />
  );
}
