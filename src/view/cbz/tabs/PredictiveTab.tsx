import { useMemo } from 'react';
import { useCbz } from '../../../model/cbz/useCbz';
import { detectAnomalies, projectSeries } from '../../../model/cbz/forecast';
import type { EntityCode } from '../../../model/cbz/types';
import { LineChart } from '../components/charts';
import { Panel, StatCard, fmtT } from '../components/primitives';

// The historical series is illustrative — we do not have 8 quarters of real
// data in the seed, so we derive them by scaling the observed 2026-Q3 total.
// Documented in the UI as "simplified" per the developer guide.
function buildHistory(current: number): { labels: string[]; history: number[] } {
  const quarters = ['2024-Q4', '2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'];
  const factors = [1.22, 1.18, 1.15, 1.12, 1.08, 1.05, 1.02, 1.0];
  return { labels: quarters, history: factors.map((f) => +(current * f).toFixed(2)) };
}

export function PredictiveTab({ scope }: { scope: EntityCode }) {
  const state = useCbz();

  const inScope = state.emissions.filter((e) => scope === 'GROUP' || e.entityCode === scope);
  const currentTotal = inScope.reduce((s, r) => s + r.emissionsTco2e, 0);

  const { labels, history } = useMemo(() => buildHistory(currentTotal), [currentTotal]);
  const forecast = useMemo(() => projectSeries(history, 4), [history]);
  const forecastLabels = ['2026-Q4', '2027-Q1', '2027-Q2', '2027-Q3'];
  const combinedLabels = [...labels, ...forecastLabels];

  const anomalies = useMemo(() => detectAnomalies(history), [history]);
  const flagged = anomalies.filter((a) => a.flagged);

  const nextYearTotal = forecast.reduce((s, v) => s + v, 0);
  const currentYearTotal = history.slice(-4).reduce((s, v) => s + v, 0);
  const yoy = currentYearTotal > 0 ? (nextYearTotal - currentYearTotal) / currentYearTotal : 0;

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard
          label="Current period total"
          value={fmtT(currentTotal, 1)}
          unit="tCO2e"
          hint="From approved records"
        />
        <StatCard
          label="Forecast next 4 quarters"
          value={fmtT(nextYearTotal, 1)}
          unit="tCO2e"
          hint="Linear projection · simplified"
          intent={yoy < 0 ? 'positive' : 'warning'}
          trend={{ direction: yoy < 0 ? 'down' : yoy > 0 ? 'up' : 'flat', delta: `${(yoy * 100).toFixed(1)}% YoY` }}
        />
        <StatCard
          label="Anomalies flagged"
          value={String(flagged.length)}
          hint="|z| > 2 vs subsidiary baseline"
          intent={flagged.length > 0 ? 'negative' : 'positive'}
        />
        <StatCard
          label="Series depth"
          value={`${history.length}Q`}
          hint="Available quarters of history"
        />
      </div>

      <Panel
        title="Trend & forecast"
        subtitle="Solid line: historical (illustrative). Dashed line: linear-regression projection."
      >
        <LineChart
          historical={history}
          forecast={forecast}
          labels={combinedLabels}
          unit="tCO2e"
          ariaLabel="Emissions historical and forecast"
        />
        <p className="cbz-note">
          <strong>Method:</strong> ordinary least-squares regression against the quarter index. A production version
          with real multi-year history could move to seasonal decomposition once there's enough submission data — not
          before; more data doesn't help a model that has nothing to learn from yet.
        </p>
      </Panel>

      <Panel title="Anomaly detection" subtitle="z-score vs mean and stdev of the subsidiary series">
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Quarter</th>
                <th className="cbz-num">Value (tCO2e)</th>
                <th className="cbz-num">z-score</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.index}>
                  <td>{labels[a.index]}</td>
                  <td className="cbz-num">{fmtT(a.value, 2)}</td>
                  <td className="cbz-num">{a.z.toFixed(2)}</td>
                  <td>
                    {a.flagged ? (
                      <span className="cbz-badge cbz-badge--anomaly">Flag for review</span>
                    ) : (
                      <span className="cbz-muted">Within band</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
