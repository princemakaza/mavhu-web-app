// Climate scenario analysis & stress testing (F15), portfolio exposure (F16) and Climate VaR (F37).
// PROTOTYPE: a transparent, explainable chain (exposure → hazard → vulnerability → PD uplift →
// expected-loss change). Parameters are illustrative until validated by the bank's risk team.
import { useMemo, useState } from 'react';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import type { Counterparty, EntityCode } from '../../../model/cbz/types';
import { BarChart } from '../components/charts';
import { EmptyState, MethodNote, Panel, RagChip, StatCard, fmtPct, fmtUsd } from '../components/primitives';

interface Scenario {
  key: string;
  name: string;
  family: string;
  carbonPrice2030: number;
  physicalMultiplier: number;
  note: string;
}

// Directional NGFS Phase IV narratives; prices are rounded illustrative values (US$/tCO2e, 2030).
const SCENARIOS: Scenario[] = [
  { key: 'nz', name: 'Net Zero 2050', family: 'Orderly', carbonPrice2030: 140, physicalMultiplier: 1.0, note: 'Early, smooth policy; highest transition cost, lowest physical damage.' },
  { key: 'dt', name: 'Delayed Transition', family: 'Disorderly', carbonPrice2030: 110, physicalMultiplier: 1.2, note: 'Policy arrives late and abruptly: sharp repricing after 2030.' },
  { key: 'cp', name: 'Current Policies', family: 'Hot house world', carbonPrice2030: 10, physicalMultiplier: 1.6, note: 'Little new policy; physical risks (drought, floods) dominate.' },
];

const BASE_PD: Record<string, number> = { Sovereign: 0.01, 'Sub-sovereign': 0.015 };
const LGD = 0.45;
const SECTOR_VULNERABILITY = (sector: string) => (/agri|farm|maize|tea|sugar/i.test(sector) ? 0.8 : /real estate|residential|property/i.test(sector) ? 0.5 : /sovereign/i.test(sector) ? 0.2 : 0.3);
const HAZARD_SCORE: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

interface PositionResult {
  cp: Counterparty;
  outstanding: number;
  carbonCostRatio: number;
  hazard: number;
  hazardObserved: boolean;
  basePd: number;
  transitionPd: number;
  physicalPd: number;
  deltaEl: number;
  transitionEl: number;
  physicalEl: number;
  geography: string;
}

export function ScenariosTab({ scope }: { scope: EntityCode }) {
  const { state, mrv } = useCbzData();
  const [active, setActive] = useState('dt');

  const base = useMemo(() => {
    const out = new Map<string, number>();
    for (const p of state.financedPositions) out.set(p.counterpartyId, (out.get(p.counterpartyId) ?? 0) + p.outstandingAmountUsd);
    const geo = new Map<string, { hazard: number; district: string }>();
    for (const g of state.geospatial) {
      const h = Math.max(HAZARD_SCORE[g.floodRisk] ?? 1, HAZARD_SCORE[g.droughtStress] ?? 1);
      const k = g.linkedBorrowerName.toLowerCase();
      if ((geo.get(k)?.hazard ?? 0) < h) geo.set(k, { hazard: h, district: g.district });
    }
    // MRV: a falling 12-month NDVI mean is observed drought/degradation stress.
    const mrvHazard = new Map(mrv.map((m) => [m.counterpartyId, m.avgNdvi12m !== null && m.avgNdviPrior12m !== null && m.avgNdvi12m < m.avgNdviPrior12m - 0.03 ? 3 : 1]));
    return state.counterparties
      .filter((c) => (scope === 'GROUP' || c.subsidiary === scope) && (out.get(c.id) ?? 0) > 0)
      .map((cp) => {
        const g = geo.get(cp.name.toLowerCase());
        const observed = g?.hazard ?? mrvHazard.get(cp.id);
        return {
          cp,
          outstanding: out.get(cp.id) ?? 0,
          revenue: cp.financials.totalRevenue ?? Object.values(cp.financials).find((v) => typeof v === 'number' && v > 0) ?? 0,
          hazard: observed ?? (/agri/i.test(cp.sector) ? 2 : 1),
          hazardObserved: observed !== undefined,
          geography: g?.district ?? (cp.customerId ? 'MRV-monitored farm' : 'Not geolocated'),
        };
      });
  }, [state.counterparties, state.financedPositions, state.geospatial, mrv, scope]);

  const run = (s: Scenario): PositionResult[] =>
    base.map((b) => {
      const basePd = BASE_PD[b.cp.listedStatus] ?? 0.02;
      const carbonCostRatio = b.revenue > 0 ? (b.cp.totalEmissionsTco2e * s.carbonPrice2030) / b.revenue : 0;
      const transitionPd = basePd * Math.min(4, 6 * carbonCostRatio) * (s.key === 'dt' ? 1.3 : 1);
      const physicalPd = basePd * (b.hazard / 3) * SECTOR_VULNERABILITY(b.cp.sector) * s.physicalMultiplier;
      const transitionEl = b.outstanding * transitionPd * LGD;
      const physicalEl = b.outstanding * physicalPd * LGD;
      return { ...b, basePd, carbonCostRatio, transitionPd, physicalPd, transitionEl, physicalEl, deltaEl: transitionEl + physicalEl };
    });

  const results = useMemo(() => SCENARIOS.map((s) => ({ s, rows: run(s) })), [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalExposure = base.reduce((t, b) => t + b.outstanding, 0);
  const current = results.find((r) => r.s.key === active)!;
  const sum = (rows: PositionResult[], k: 'deltaEl' | 'transitionEl' | 'physicalEl') => rows.reduce((t, r) => t + r[k], 0);

  const bySector = (rows: PositionResult[]) => {
    const m = new Map<string, { exposure: number; el: number }>();
    for (const r of rows) {
      const v = m.get(r.cp.sector) ?? { exposure: 0, el: 0 };
      v.exposure += r.outstanding;
      v.el += r.deltaEl;
      m.set(r.cp.sector, v);
    }
    return [...m.entries()].sort((a, b) => b[1].exposure - a[1].exposure);
  };
  const byGeo = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of base) m.set(b.geography, (m.get(b.geography) ?? 0) + b.outstanding);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [base]);

  if (!base.length) return <EmptyState title="No financed positions in scope." hint="Add positions on the Financed emissions tab or import a Financed Emissions sheet." />;

  return (
    <>
      <p className="cbz-alert cbz-alert--info">
        <strong>Prototype.</strong> Results follow a documented chain (exposure → hazard → vulnerability → credit impact → Climate VaR) with illustrative parameters. Label as Prototype in disclosures until validated.
      </p>
      <div className="cbz-grid cbz-grid--stats">
        {results.map(({ s, rows }) => (
          <button key={s.key} type="button" className={`cbz-stat cbz-stat--button ${active === s.key ? 'is-active' : ''}`} onClick={() => setActive(s.key)}>
            <div className="cbz-stat__label">
              {s.name} · {s.family}
            </div>
            <div className="cbz-stat__value">{fmtUsd(sum(rows, 'deltaEl'))}</div>
            <div className="cbz-stat__meta">
              Climate VaR · {fmtPct(totalExposure ? sum(rows, 'deltaEl') / totalExposure : 0, 2)} of exposure
            </div>
          </button>
        ))}
      </div>

      <Panel title={`${current.s.name}: where the loss comes from`} subtitle={current.s.note}>
        <div className="cbz-grid cbz-grid--halves">
          <div>
            <StatCard label="Transition (carbon price)" value={fmtUsd(sum(current.rows, 'transitionEl'))} hint={`US$${current.s.carbonPrice2030}/tCO2e in 2030`} intent="warning" />
          </div>
          <div>
            <StatCard label="Physical (hazard × vulnerability)" value={fmtUsd(sum(current.rows, 'physicalEl'))} hint={`Physical severity ×${current.s.physicalMultiplier}`} intent="negative" />
          </div>
        </div>
        <BarChart
          data={bySector(current.rows).slice(0, 8).map(([sector, v]) => ({ label: sector, value: +(v.el / 1000).toFixed(1) }))}
          unit="k$"
          ariaLabel="Expected-loss uplift by sector"
        />
      </Panel>

      <div className="cbz-grid cbz-grid--halves">
        <Panel title="Exposure by sector" subtitle="Outstanding and scenario loss uplift (F16)" padded={false}>
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Sector</th>
                  <th className="cbz-num">Exposure</th>
                  <th className="cbz-num">Share</th>
                  <th className="cbz-num">VaR</th>
                </tr>
              </thead>
              <tbody>
                {bySector(current.rows).map(([sector, v]) => (
                  <tr key={sector}>
                    <td>{sector}</td>
                    <td className="cbz-num">{fmtUsd(v.exposure)}</td>
                    <td className="cbz-num">{fmtPct(v.exposure / totalExposure, 1)}</td>
                    <td className="cbz-num">{fmtUsd(v.el)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Exposure by geography" subtitle="From satellite / geospatial monitoring" padded={false}>
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Location</th>
                  <th className="cbz-num">Exposure</th>
                  <th className="cbz-num">Share</th>
                </tr>
              </thead>
              <tbody>
                {byGeo.map(([g, v]) => (
                  <tr key={g}>
                    <td>{g}</td>
                    <td className="cbz-num">{fmtUsd(v)}</td>
                    <td className="cbz-num">{fmtPct(v / totalExposure, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Most affected positions" subtitle={`${current.s.name}: top 10 by expected-loss uplift`} padded={false}>
        <div className="cbz-table-wrap">
          <table className="cbz-table cbz-table--compact">
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Sector</th>
                <th className="cbz-num">Exposure</th>
                <th className="cbz-num">Carbon cost / revenue</th>
                <th>Hazard</th>
                <th className="cbz-num">PD base → stressed</th>
                <th className="cbz-num">Climate VaR</th>
              </tr>
            </thead>
            <tbody>
              {[...current.rows]
                .sort((a, b) => b.deltaEl - a.deltaEl)
                .slice(0, 10)
                .map((r) => (
                  <tr key={r.cp.id}>
                    <td>{r.cp.name}</td>
                    <td>{r.cp.sector}</td>
                    <td className="cbz-num">{fmtUsd(r.outstanding)}</td>
                    <td className="cbz-num">{fmtPct(r.carbonCostRatio, 1)}</td>
                    <td>
                      <RagChip status={r.hazard >= 3 ? 'red' : r.hazard >= 2 ? 'amber' : 'green'} label={`${r.hazard >= 3 ? 'High' : r.hazard >= 2 ? 'Medium' : 'Low'}${r.hazardObserved ? '' : ' (proxy)'}`} />
                    </td>
                    <td className="cbz-num">
                      {fmtPct(r.basePd, 1)} → {fmtPct(r.basePd + r.transitionPd + r.physicalPd, 1)}
                    </td>
                    <td className="cbz-num">{fmtUsd(r.deltaEl)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Assumptions" subtitle="Observed inputs come from bank data and MAvHU monitoring; modelled inputs are parameters to validate.">
        <div className="cbz-table-wrap">
          <table className="cbz-table cbz-table--compact">
            <thead>
              <tr>
                <th>Input</th>
                <th>Value</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Exposure (outstanding)', 'Financed positions', 'Observed'],
                ['Borrower emissions & revenue', 'Counterparty records (PCAF inputs)', 'Observed'],
                ['Hazard: flood / drought', 'Satellite & geospatial flags; falling 12-month NDVI from MAvHU MRV', 'Observed (proxy where not monitored)'],
                ['Carbon price 2030', SCENARIOS.map((s) => `${s.name} $${s.carbonPrice2030}`).join(' · '), 'Modelled (NGFS-directional)'],
                ['Sector vulnerability', 'Agriculture 0.8 · real estate 0.5 · sovereign 0.2 · other 0.3', 'Modelled'],
                ['Base PD', '2% corporate, 1% sovereign, 1.5% sub-sovereign', 'Modelled (replace with internal ratings)'],
                ['Transition PD uplift', 'base PD × min(4, 6 × carbon cost / revenue); ×1.3 in a disorderly transition', 'Modelled'],
                ['Physical PD uplift', 'base PD × hazard/3 × vulnerability × scenario severity', 'Modelled'],
                ['LGD', `${LGD * 100}%`, 'Modelled'],
              ].map(([a, b, c]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td>{b}</td>
                  <td>{c.startsWith('Observed') ? <RagChip status="green" label={c} /> : <RagChip status="amber" label={c} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <MethodNote>Climate VaR here is the change in expected credit loss under each scenario, a common first approximation (RFP F37). It does not yet model collateral revaluation or second-order effects.</MethodNote>
      </Panel>
    </>
  );
}
