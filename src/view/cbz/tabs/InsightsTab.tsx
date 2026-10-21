// Explainable analytics on approved data (F28, F47; P15): trend forecasting, anomaly detection
// against each series' own baseline, inconsistency checks and plain-language insights.
import { useMemo, useState } from 'react';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import { detectAnomalies, linearRegression, projectSeries } from '../../../model/cbz/forecast';
import type { EntityCode } from '../../../model/cbz/types';
import { LineChart } from '../components/charts';
import { EmptyState, MethodNote, Panel, RagChip, StatCard, fmtT } from '../components/primitives';

const MONTH = /^\d{4}-\d{2}$/;

export function InsightsTab({ scope }: { scope: EntityCode }) {
  const { state, appendAudit, can } = useCbzData();
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Approved monthly records only: the methods never see drafts.
  const approved = useMemo(
    () => state.emissions.filter((e) => ['approved', 'locked'].includes(e.status) && MONTH.test(e.period) && (scope === 'GROUP' || e.entityCode === scope)),
    [state.emissions, scope],
  );

  // One series per subsidiary × dataset; z-score of each month against that series' own mean.
  const series = useMemo(() => {
    const map = new Map<string, { entity: string; dataset: string; points: Array<{ period: string; value: number; id: string }> }>();
    for (const e of approved) {
      const key = `${e.entityCode}|${e.datasetType}`;
      if (!map.has(key)) map.set(key, { entity: e.entityCode, dataset: e.datasetType, points: [] });
      // Several records in one month (e.g. one per site) add up to a single point.
      const points = map.get(key)!.points;
      const same = points.find((p) => p.period === e.period);
      if (same) same.value += Number(e.emissionsTco2e);
      else points.push({ period: e.period, value: Number(e.emissionsTco2e), id: e.id });
    }
    for (const s of map.values()) s.points.sort((a, b) => a.period.localeCompare(b.period));
    return [...map.values()].filter((s) => s.points.length >= 6);
  }, [approved]);

  // The total and forecast use only series with real history, so a one-off batch (e.g. a single
  // month covering more subsidiaries) does not show up as a spike.
  // Trailing months where some series are still awaiting approval are left out, so a partly
  // approved latest month does not read as a sudden drop and skew the projection.
  const months = useMemo(() => {
    const all = [...new Set(series.flatMap((s) => s.points.map((p) => p.period)))].sort();
    const complete = (m: string) => series.every((s) => s.points.some((p) => p.period === m));
    while (all.length > 0 && !complete(all[all.length - 1])) all.pop();
    return all;
  }, [series]);
  const total = months.map((m) => series.reduce((t, s) => t + (s.points.find((p) => p.period === m)?.value ?? 0), 0));
  const trendWindow = total.slice(-18);
  const forecast = projectSeries(trendWindow, 6);
  const slope = linearRegression(trendWindow).slope;
  const axisLabels = [...months, ...forecast.map((_, i) => `+${i + 1}m`)];

  const anomalies = useMemo(
    () =>
      series
        .flatMap((s) => {
          const flags = detectAnomalies(s.points.map((p) => p.value));
          const mean = s.points.reduce((t, p) => t + p.value, 0) / s.points.length;
          return flags.filter((f) => Math.abs(f.z) > 2.5).map((f) => ({ ...s.points[f.index], entity: s.entity, dataset: s.dataset, z: f.z, mean }));
        })
        .sort((a, b) => Math.abs(b.z) - Math.abs(a.z)),
    [series],
  );

  // Inconsistency: the latest month against the same month a year earlier for each series.
  const inconsistencies = useMemo(
    () =>
      series
        .map((s) => {
          const last = s.points[s.points.length - 1];
          const year = Number(last.period.slice(0, 4)) - 1;
          const prior = s.points.find((p) => p.period === `${year}${last.period.slice(4)}`);
          if (!prior || prior.value === 0) return null;
          const change = (last.value - prior.value) / prior.value;
          return Math.abs(change) > 0.3 ? { ...s, last, prior, change } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [series],
  );

  // Insight generation: what moved, by how much, since when.
  const insights = useMemo(() => {
    const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort();
    if (years.length < 2) return [];
    const [prev, cur] = years.slice(-2);
    const curMonths = months.filter((m) => m.startsWith(cur)).map((m) => m.slice(5));
    const out: Array<{ text: string; change: number; owner: string }> = [];
    const keys = new Set(approved.map((e) => `${e.entityCode}|${e.scope}`));
    for (const key of keys) {
      const [entity, sc] = key.split('|');
      const sumFor = (y: string) => approved.filter((e) => e.entityCode === entity && e.scope === sc && e.period.startsWith(y) && curMonths.includes(e.period.slice(5))).reduce((s, e) => s + Number(e.emissionsTco2e), 0);
      const a = sumFor(prev);
      const b = sumFor(cur);
      if (!a) continue;
      const change = (b - a) / a;
      const name = state.entities.find((en) => en.code === entity)?.name ?? entity;
      out.push({
        text: `${sc.replace('scope', 'Scope ')} at ${name} ${change < 0 ? 'fell' : 'rose'} ${Math.abs(change * 100).toFixed(1)}% (${fmtT(a, 1)} → ${fmtT(b, 1)} tCO2e) for ${cur} year-to-date against the same months of ${prev}.`,
        change,
        owner: `${name} data owner`,
      });
    }
    return out.sort((x, y) => Math.abs(y.change) - Math.abs(x.change)).slice(0, 6);
  }, [approved, months, state.entities]);

  async function flag(a: (typeof anomalies)[number]) {
    setError(null);
    try {
      await appendAudit({
        action: 'ANOMALY',
        targetType: 'EmissionRecord',
        targetId: a.id,
        entityCode: a.entity,
        detail: `Flagged for human review: ${a.dataset} ${a.period} = ${fmtT(a.value, 2)} tCO2e (z = ${a.z.toFixed(1)} against a ${fmtT(a.mean, 2)} mean)`,
      });
      setFlagged(new Set(flagged).add(a.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not flag');
    }
  }

  if (months.length < 6) return <EmptyState title="Not enough approved history yet." hint="Forecasts and anomaly checks need at least six months of approved records." />;

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Approved history" value={`${months.length} months`} hint={`${months[0]} → ${months[months.length - 1]}`} />
        <StatCard label="Trend" value={`${slope >= 0 ? '+' : ''}${fmtT(slope, 2)}`} unit="tCO2e / month" hint="Linear fit, last 18 months" intent={slope <= 0 ? 'positive' : 'warning'} />
        <StatCard label="Anomalies" value={String(anomalies.length)} hint="|z| > 2.5 against own baseline" intent={anomalies.length ? 'warning' : 'neutral'} />
        <StatCard label="Inconsistencies" value={String(inconsistencies.length)} hint="> 30% vs same month last year" intent={inconsistencies.length ? 'warning' : 'neutral'} />
      </div>

      <Panel
        title="Operational emissions: history and forecast"
        subtitle={`Solid: approved monthly totals of the ${series.length} series with 6+ months of history. Dashed: 6-month linear-trend projection from the last 18 months.`}
      >
        <LineChart historical={total} forecast={forecast} labels={axisLabels} unit="tCO2e" ariaLabel="Emissions history and forecast" />
        <MethodNote>Approved data only · explainable methods (ordinary least squares, z-scores) · every flag goes to a human, nothing is auto-published.</MethodNote>
      </Panel>

      <Panel title="What moved" subtitle="Generated statements: what changed, by how much and since when, with the owner to act" padded={false}>
        <ul className="cbz-insights">
          {insights.map((i) => (
            <li key={i.text}>
              <RagChip status={i.change < 0 ? 'green' : 'amber'} label={`${i.change < 0 ? '▼' : '▲'} ${Math.abs(i.change * 100).toFixed(1)}%`} />
              <span>{i.text}</span>
              <span className="cbz-muted">Owner: {i.owner}</span>
            </li>
          ))}
          {insights.length === 0 && <li className="cbz-muted">Needs two years of approved data.</li>}
        </ul>
      </Panel>

      <Panel title="Anomalies routed to review" subtitle="Each value is compared with its own series (same subsidiary and dataset)" padded={false}>
        {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
        <div className="cbz-table-wrap">
          <table className="cbz-table cbz-table--compact">
            <thead>
              <tr>
                <th>Period</th>
                <th>Entity</th>
                <th>Dataset</th>
                <th className="cbz-num">Value</th>
                <th className="cbz-num">Series mean</th>
                <th className="cbz-num">z-score</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id}>
                  <td className="cbz-mono">{a.period}</td>
                  <td>{a.entity}</td>
                  <td>{a.dataset}</td>
                  <td className="cbz-num">{fmtT(a.value, 2)}</td>
                  <td className="cbz-num">{fmtT(a.mean, 2)}</td>
                  <td className="cbz-num">
                    <RagChip status="red" label={a.z.toFixed(1)} />
                  </td>
                  <td>
                    {flagged.has(a.id) ? (
                      <span className="cbz-muted">Flagged ✓</span>
                    ) : (
                      can('submit-data') && (
                        <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => flag(a)}>
                          Flag for review
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
              {anomalies.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="No anomalies in approved data." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {inconsistencies.length > 0 && (
        <Panel title="Inconsistency checks" subtitle="Latest month against the same month last year" padded={false}>
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Dataset</th>
                  <th>Compared</th>
                  <th className="cbz-num">Change</th>
                </tr>
              </thead>
              <tbody>
                {inconsistencies.map((c) => (
                  <tr key={`${c.entity}-${c.dataset}`}>
                    <td>{c.entity}</td>
                    <td>{c.dataset}</td>
                    <td className="cbz-mono">
                      {c.prior.period} → {c.last.period}
                    </td>
                    <td className="cbz-num">{`${c.change > 0 ? '+' : ''}${(c.change * 100).toFixed(0)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
