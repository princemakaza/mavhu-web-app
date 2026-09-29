import { useMemo } from 'react';
import { useCbz } from '../../../model/cbz/useCbz';
import { summariseInsurance, summarisePortfolio } from '../../../model/cbz/calculators';
import type { EntityCode } from '../../../model/cbz/types';
import { BarChart, DoughnutChart, StackedBar } from '../components/charts';
import { Panel, StatCard, fmtT, fmtUsd, fmtPct } from '../components/primitives';

export function SnapshotTab({ scope }: { scope: EntityCode }) {
  const state = useCbz();

  const inScope = <T extends { entityCode?: EntityCode; subsidiary?: EntityCode }>(items: T[]) =>
    scope === 'GROUP'
      ? items
      : items.filter((x) => (x.entityCode ?? x.subsidiary) === scope);

  const emissions = inScope(state.emissions).filter((e) => e.status !== 'draft');
  const scope1 = emissions.filter((e) => e.scope === 'scope1').reduce((s, r) => s + Number(r.emissionsTco2e), 0);
  const scope2 = emissions.filter((e) => e.scope === 'scope2').reduce((s, r) => s + Number(r.emissionsTco2e), 0);
  const scope3 = emissions.filter((e) => e.scope === 'scope3').reduce((s, r) => s + Number(r.emissionsTco2e), 0);
  const total = scope1 + scope2 + scope3;

  const counterparties = scope === 'GROUP'
    ? state.counterparties
    : state.counterparties.filter((c) => c.subsidiary === scope);
  const positions = state.financedPositions.filter((p) =>
    counterparties.some((c) => c.id === p.counterpartyId),
  );
  const portfolio = summarisePortfolio(counterparties, positions);
  const insurance = summariseInsurance(
    scope === 'GROUP'
      ? state.insurance
      : state.insurance.filter((p) => p.subsidiary === scope),
  );

  const emissionsByEntity = useMemo(() => {
    const map = new Map<EntityCode, number>();
    for (const rec of state.emissions.filter((e) => e.status !== 'draft')) {
      map.set(rec.entityCode, (map.get(rec.entityCode) ?? 0) + Number(rec.emissionsTco2e));
    }
    return [...map.entries()]
      .map(([code, value]) => ({
        label: state.entities.find((e) => e.code === code)?.name.replace('CBZ ', '') ?? code,
        value: +value.toFixed(2),
      }))
      .sort((a, b) => b.value - a.value);
  }, [state.emissions, state.entities]);

  const workforce = scope === 'GROUP'
    ? state.workforce
    : state.workforce.filter((w) => w.subsidiary === scope);
  const totalHeadcount = workforce.reduce((s, w) => s + w.headcount, 0);
  const weightedFemale = totalHeadcount === 0
    ? 0
    : workforce.reduce((s, w) => s + w.femaleShare * w.headcount, 0) / totalHeadcount;

  const openIncidents = state.incidents.filter((i) => (scope === 'GROUP' || i.subsidiary === scope) && i.status !== 'Closed').length;
  const totalIncidents = state.incidents.filter((i) => scope === 'GROUP' || i.subsidiary === scope).length;

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard
          label="Total operational emissions"
          value={fmtT(total, 1)}
          unit="tCO2e"
          hint={`Scope 1+2+3 · ${emissions.length} approved records`}
          intent="warning"
        />
        <StatCard
          label="Financed emissions"
          value={fmtT(portfolio.totalFinancedEmissions, 1)}
          unit="tCO2e"
          hint={`${portfolio.positions} positions · DQ ${portfolio.weightedAvgDq.toFixed(2)}`}
          intent="neutral"
        />
        <StatCard
          label="Portfolio outstanding"
          value={fmtUsd(portfolio.totalOutstandingUsd)}
          hint="Across all PCAF asset classes"
          intent="positive"
        />
        <StatCard
          label="Insurance-associated"
          value={fmtT(insurance.totalEmissions, 1)}
          unit="tCO2e"
          hint={`${insurance.count} policies · $${(insurance.totalPremium / 1000).toFixed(0)}k premium`}
          intent="neutral"
        />
        <StatCard
          label="Workforce headcount"
          value={totalHeadcount.toLocaleString()}
          hint={`Female share ${fmtPct(weightedFemale)}`}
          intent="positive"
        />
        <StatCard
          label="Open ESG incidents"
          value={String(openIncidents)}
          hint={`Of ${totalIncidents} total in period`}
          intent={openIncidents > 0 ? 'negative' : 'positive'}
        />
      </div>

      <div className="cbz-grid cbz-grid--halves">
        <Panel title="Scope 1 · 2 · 3 breakdown" subtitle="Approved records only (GHG Protocol)">
          <DoughnutChart
            centerLabel="tCO2e"
            centerValue={fmtT(total, 1)}
            segments={[
              { label: 'Scope 1 — Direct', value: scope1, color: '#0f2b45' },
              { label: 'Scope 2 — Energy', value: scope2, color: '#b8860b' },
              { label: 'Scope 3 — Value chain', value: scope3, color: '#0e7c66' },
            ]}
          />
          <div className="cbz-legend-note cbz-muted">
            Location-based Scope 2 shown. Market-based figures available in the Entity tab.
          </div>
        </Panel>

        <Panel title="Emissions by subsidiary" subtitle="Cross-entity comparison, tCO2e">
          <BarChart data={emissionsByEntity} unit="tCO2e" ariaLabel="Emissions by subsidiary" />
        </Panel>
      </div>

      <div className="cbz-grid cbz-grid--halves">
        <Panel title="Portfolio composition" subtitle="Outstanding by asset class">
          <StackedBar
            segments={groupBy(counterparties, positions).map((g) => ({
              label: g.label,
              value: g.outstanding,
              color: g.color,
            }))}
          />
          <ul className="cbz-list cbz-list--sm">
            {groupBy(counterparties, positions).map((g) => (
              <li key={g.label}>
                <span className="cbz-swatch" style={{ background: g.color }} />
                <span>{g.label}</span>
                <strong>{fmtUsd(g.outstanding)}</strong>
                <span className="cbz-muted">{fmtT(g.emissions, 1)} tCO2e</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Ingestion pipeline"
          subtitle="Last batches — files, satellite feeds & API pushes"
        >
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Source</th>
                  <th>Records</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.ingestion
                  .filter((b) => scope === 'GROUP' || b.subsidiary === scope)
                  .slice(0, 6)
                  .map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div>{b.id}</div>
                        <div className="cbz-muted cbz-mono">{b.fileName}</div>
                      </td>
                      <td>{b.channel.replace(' (manual upload)', '')}</td>
                      <td>{b.recordsProcessed}</td>
                      <td>
                        <span className={`cbz-badge cbz-badge--ingest-${b.validationStatus.toLowerCase()}`}>
                          {b.validationStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

const PALETTE = ['#0f2b45', '#b8860b', '#0e7c66', '#5925dc', '#175cd3', '#b54708', '#b42318', '#4b5563', '#0b7285', '#6d28d9'];

function groupBy(counterparties: ReturnType<typeof useCbz>['counterparties'], positions: ReturnType<typeof useCbz>['financedPositions']) {
  const byId = new Map(counterparties.map((c) => [c.id, c]));
  const groups = new Map<string, { outstanding: number; emissions: number }>();
  for (const p of positions) {
    const cp = byId.get(p.counterpartyId);
    if (!cp) continue;
    const cur = groups.get(cp.assetClass) ?? { outstanding: 0, emissions: 0 };
    cur.outstanding += p.outstandingAmountUsd;
    const denomKey = Object.keys(cp.financials).find((k) => cp.financials[k as keyof typeof cp.financials]) as keyof typeof cp.financials | undefined;
    const denomVal = denomKey ? cp.financials[denomKey] ?? 0 : 0;
    const attribution = denomVal > 0 ? p.outstandingAmountUsd / denomVal : 0;
    cur.emissions += attribution * cp.totalEmissionsTco2e;
    groups.set(cp.assetClass, cur);
  }
  return [...groups.entries()].map(([label, v], idx) => ({
    label: label.replace(/_/g, ' '),
    outstanding: v.outstanding,
    emissions: v.emissions,
    color: PALETTE[idx % PALETTE.length],
  }));
}
