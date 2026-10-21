import { useMemo, useState } from 'react';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import { useCbz } from '../../../model/cbz/useCbz';
import { calculatePcaf, summarisePortfolio } from '../../../model/cbz/calculators';
import { ASSET_CLASS_LABEL } from '../../../model/cbz/types';
import type { AssetClass, CbzSession, Counterparty, EntityCode } from '../../../model/cbz/types';
import { BarChart } from '../components/charts';
import { DqPill, EmptyState, Panel, StatCard, fmtT, fmtUsd, fmtPct } from '../components/primitives';

interface Props {
  scope: EntityCode;
  session: CbzSession;
}

export function PortfolioTab({ scope, session }: Props) {
  const state = useCbz();
  const { can } = useCbzData();
  const canWrite = can('write-data');

  const [assetClassFilter, setAssetClassFilter] = useState<AssetClass | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);

  const counterparties = useMemo(
    () => (scope === 'GROUP' ? state.counterparties : state.counterparties.filter((c) => c.subsidiary === scope)),
    [scope, state.counterparties],
  );
  const positions = useMemo(
    () => state.financedPositions.filter((p) => counterparties.some((c) => c.id === p.counterpartyId)),
    [counterparties, state.financedPositions],
  );

  const filteredPositions = useMemo(
    () =>
      assetClassFilter === 'all'
        ? positions
        : positions.filter((p) => {
            const cp = counterparties.find((c) => c.id === p.counterpartyId);
            return cp?.assetClass === assetClassFilter;
          }),
    [assetClassFilter, positions, counterparties],
  );

  const summary = summarisePortfolio(counterparties, filteredPositions);

  const byClass = useMemo(() => {
    const map = new Map<AssetClass, { outstanding: number; emissions: number; positions: number; dq: number }>();
    for (const p of positions) {
      const cp = counterparties.find((c) => c.id === p.counterpartyId);
      if (!cp) continue;
      const result = calculatePcaf(cp, p.outstandingAmountUsd);
      const cur = map.get(cp.assetClass) ?? { outstanding: 0, emissions: 0, positions: 0, dq: 0 };
      cur.outstanding += p.outstandingAmountUsd;
      cur.emissions += result.financedEmissionsTco2e;
      cur.positions += 1;
      cur.dq += result.financedEmissionsTco2e * result.dataQualityScore;
      map.set(cp.assetClass, cur);
    }
    return [...map.entries()].map(([cls, v]) => ({
      cls,
      label: ASSET_CLASS_LABEL[cls],
      outstanding: v.outstanding,
      emissions: v.emissions,
      positions: v.positions,
      weightedDq: v.emissions > 0 ? v.dq / v.emissions : 0,
    }));
  }, [counterparties, positions]);

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Positions" value={summary.positions.toString()} hint="In current filter" />
        <StatCard label="Outstanding" value={fmtUsd(summary.totalOutstandingUsd)} hint="Sum of exposures" intent="positive" />
        <StatCard
          label="Financed emissions"
          value={fmtT(summary.totalFinancedEmissions, 1)}
          unit="tCO2e"
          hint="Attribution × counterparty emissions"
          intent="warning"
        />
        <StatCard
          label="Weighted DQ score"
          value={summary.weightedAvgDq.toFixed(2)}
          hint="1 = verified · 5 = economic estimation"
          intent={summary.weightedAvgDq <= 3 ? 'positive' : 'warning'}
        />
      </div>

      <Panel
        title="Portfolio by PCAF asset class"
        subtitle="Financed emissions per class · Weighted DQ shown on each bar"
        action={
          <div className="cbz-toolbar">
            <label className="cbz-field cbz-field--inline">
              <span>Asset class</span>
              <select
                value={assetClassFilter}
                onChange={(e) => setAssetClassFilter(e.target.value as typeof assetClassFilter)}
              >
                <option value="all">All classes</option>
                {(Object.keys(ASSET_CLASS_LABEL) as AssetClass[]).map((k) => (
                  <option key={k} value={k}>
                    {ASSET_CLASS_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            {canWrite && (
              <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setShowAdd(true)}>
                + Add position
              </button>
            )}
          </div>
        }
      >
        <BarChart
          unit="tCO2e"
          ariaLabel="Financed emissions by asset class"
          data={byClass.map((c) => ({ label: c.label, value: +c.emissions.toFixed(1) }))}
        />
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Asset class</th>
                <th>Positions</th>
                <th className="cbz-num">Outstanding</th>
                <th className="cbz-num">Financed emissions (tCO2e)</th>
                <th>Weighted DQ</th>
              </tr>
            </thead>
            <tbody>
              {byClass.map((row) => (
                <tr key={row.cls}>
                  <td>{row.label}</td>
                  <td>{row.positions}</td>
                  <td className="cbz-num">{fmtUsd(row.outstanding)}</td>
                  <td className="cbz-num">{fmtT(row.emissions, 1)}</td>
                  <td>
                    <DqPill score={row.weightedDq} />
                  </td>
                </tr>
              ))}
              {byClass.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="No positions yet" hint="Add a counterparty and financed position to see them here." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Positions" subtitle="Live PCAF attribution factor and DQ per counterparty">
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Counterparty</th>
                <th>Asset class</th>
                <th className="cbz-num">Outstanding</th>
                <th className="cbz-num">Attribution</th>
                <th className="cbz-num">Financed emissions</th>
                <th>DQ</th>
                <th>MRV</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((p) => {
                const cp = counterparties.find((c) => c.id === p.counterpartyId);
                if (!cp) return null;
                const result = calculatePcaf(cp, p.outstandingAmountUsd);
                return (
                  <tr key={p.id}>
                    <td className="cbz-mono">{p.id}</td>
                    <td>
                      <div>{cp.name}</div>
                      <div className="cbz-muted">{cp.sector} · {cp.subsidiary}</div>
                    </td>
                    <td>{ASSET_CLASS_LABEL[cp.assetClass]}</td>
                    <td className="cbz-num">{fmtUsd(p.outstandingAmountUsd)}</td>
                    <td className="cbz-num">{fmtPct(result.attributionFactor, 3)}</td>
                    <td className="cbz-num">{fmtT(result.financedEmissionsTco2e, 2)}</td>
                    <td>
                      <DqPill score={cp.dqScore} />
                    </td>
                    <td>
                      {cp.mrvEnhanced ? (
                        <span className="cbz-badge cbz-badge--mrv">MRV-enhanced</span>
                      ) : (
                        <span className="cbz-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <MrvPanel scope={scope} />

      {showAdd && (
        <AddPositionModal
          counterparties={counterparties}
          scope={scope}
          onClose={() => setShowAdd(false)}
          actor={session.fullName}
        />
      )}
    </>
  );
}

function AddPositionModal({
  counterparties,
  scope,
  onClose,
  actor,
}: {
  counterparties: Counterparty[];
  scope: EntityCode;
  onClose: () => void;
  actor: string;
}) {
  const { state, addCounterparty, addFinancedPosition } = useCbzData();
  // At Group scope a new counterparty lands in the bank's first subsidiary, never a hard-coded one.
  const groupDefault = state.entities[0]?.code ?? '';
  const [mode, setMode] = useState<'existing' | 'new'>(counterparties.length > 0 ? 'existing' : 'new');
  const [counterpartyId, setCounterpartyId] = useState(counterparties[0]?.id ?? '');
  const [outstanding, setOutstanding] = useState('');
  const [period, setPeriod] = useState('2026-Q3');
  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('business_loans_unlisted_equity');
  const [denomValue, setDenomValue] = useState('');
  const [totalEmissions, setTotalEmissions] = useState('');
  const [dqScore, setDqScore] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [error, setError] = useState<string | null>(null);

  function denomLabel(cls: AssetClass): string {
    switch (cls) {
      case 'business_loans_unlisted_equity':
        return 'Total Equity + Debt (US$)';
      case 'business_loans_listed':
      case 'listed_equity_corporate_bonds':
        return 'EVIC (US$)';
      case 'project_finance':
        return 'Project total cost (US$)';
      case 'commercial_real_estate':
      case 'mortgages':
        return 'Property value (US$)';
      case 'motor_vehicle_loans':
        return 'Vehicle value (US$)';
      case 'sovereign_debt':
        return 'PPP-adjusted GDP (US$)';
      case 'sub_sovereign_debt':
        return 'Regional PPP-adj. GDP proxy (US$)';
      case 'use_of_proceeds':
        return 'Use-of-proceeds structure value (US$)';
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const out = Number.parseFloat(outstanding);
    if (!Number.isFinite(out) || out <= 0) {
      setError('Outstanding amount must be a positive number.');
      return;
    }
    try {
      let cpId = counterpartyId;
      if (mode === 'new') {
        if (!name.trim()) {
          setError('Counterparty name is required.');
          return;
        }
        const denom = Number.parseFloat(denomValue);
        const emis = Number.parseFloat(totalEmissions);
        if (!Number.isFinite(denom) || denom <= 0) {
          setError('Denominator value must be a positive number.');
          return;
        }
        if (!Number.isFinite(emis) || emis <= 0) {
          setError('Counterparty total emissions must be a positive number.');
          return;
        }
        const financials: Counterparty['financials'] = {};
        switch (assetClass) {
          case 'business_loans_unlisted_equity':
            financials.totalEquityDebt = denom;
            break;
          case 'business_loans_listed':
          case 'listed_equity_corporate_bonds':
            financials.evic = denom;
            break;
          case 'project_finance':
            financials.projectTotalCost = denom;
            break;
          case 'commercial_real_estate':
          case 'mortgages':
            financials.propertyValue = denom;
            break;
          case 'motor_vehicle_loans':
            financials.vehicleValue = denom;
            break;
          case 'sovereign_debt':
            financials.gdpPpp = denom;
            break;
          case 'sub_sovereign_debt':
            financials.regionalGdpPpp = denom;
            break;
          case 'use_of_proceeds':
            financials.uopStructureValue = denom;
            break;
        }
        const cp = await addCounterparty({
          name: name.trim(),
          sector: sector.trim() || 'Not specified',
          listedStatus: 'Unlisted',
          assetClass,
          subsidiary: scope === 'GROUP' ? groupDefault : scope,
          financials,
          totalEmissionsTco2e: emis,
          dqScore,
          mrvEnhanced: false,
        });
        cpId = cp.id;
      }
      await addFinancedPosition({ counterpartyId: cpId, outstandingAmountUsd: out, period });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save position.');
    }
  }

  return (
    <div className="cbz-modal-backdrop" role="dialog" aria-modal="true">
      <div className="cbz-modal cbz-modal--wide">
        <header className="cbz-modal__head">
          <div>
            <h3>Add financed position</h3>
            <p className="cbz-muted">Attribution and emissions are computed automatically.</p>
          </div>
          <button type="button" className="cbz-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form className="cbz-modal__body" onSubmit={submit}>
          <div className="cbz-tabs">
            <button
              type="button"
              className={`cbz-tabs__tab ${mode === 'existing' ? 'is-active' : ''}`}
              onClick={() => setMode('existing')}
              disabled={counterparties.length === 0}
            >
              Use existing counterparty
            </button>
            <button
              type="button"
              className={`cbz-tabs__tab ${mode === 'new' ? 'is-active' : ''}`}
              onClick={() => setMode('new')}
            >
              Register new counterparty
            </button>
          </div>

          {mode === 'existing' && (
            <label className="cbz-field">
              <span>Counterparty</span>
              <select value={counterpartyId} onChange={(e) => setCounterpartyId(e.target.value)}>
                {counterparties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({ASSET_CLASS_LABEL[c.assetClass]})
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode === 'new' && (
            <div className="cbz-grid cbz-grid--form">
              <label className="cbz-field">
                <span>Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="cbz-field">
                <span>Sector</span>
                <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Agri-processing" />
              </label>
              <label className="cbz-field">
                <span>PCAF asset class</span>
                <select value={assetClass} onChange={(e) => setAssetClass(e.target.value as AssetClass)}>
                  {(Object.keys(ASSET_CLASS_LABEL) as AssetClass[]).map((k) => (
                    <option key={k} value={k}>
                      {ASSET_CLASS_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cbz-field">
                <span>{denomLabel(assetClass)}</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={denomValue}
                  onChange={(e) => setDenomValue(e.target.value)}
                  placeholder="e.g. 4800000"
                  required
                />
              </label>
              <label className="cbz-field">
                <span>Counterparty total emissions (tCO2e)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={totalEmissions}
                  onChange={(e) => setTotalEmissions(e.target.value)}
                  required
                />
              </label>
              <label className="cbz-field">
                <span>PCAF data-quality score (1 best · 5 estimate)</span>
                <select value={dqScore} onChange={(e) => setDqScore(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      DQ {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="cbz-grid cbz-grid--form">
            <label className="cbz-field">
              <span>Outstanding amount (US$)</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={outstanding}
                onChange={(e) => setOutstanding(e.target.value)}
                required
              />
            </label>
            <label className="cbz-field">
              <span>Period</span>
              <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-Q3" />
            </label>
          </div>

          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}

          <footer className="cbz-modal__foot">
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cbz-btn cbz-btn--primary">
              Save position
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

/**
 * MAvHU MRV on land-based exposures (A3-A6): which borrowers are satellite-verified, what their
 * vegetation trend says about drought or degradation, and where verification would lift the
 * portfolio's PCAF data-quality score the most.
 */
function MrvPanel({ scope }: { scope: EntityCode }) {
  const state = useCbz();
  const { mrv } = useCbzData();
  const linked = mrv.filter((m) => scope === 'GROUP' || m.subsidiary === scope);

  // A4 prioritisation: unverified land-based borrowers ranked by outstanding × DQ points to gain.
  const outstanding = new Map<string, number>();
  for (const p of state.financedPositions) outstanding.set(p.counterpartyId, (outstanding.get(p.counterpartyId) ?? 0) + p.outstandingAmountUsd);
  const candidates = state.counterparties
    .filter((c) => (scope === 'GROUP' || c.subsidiary === scope) && !c.customerId && /agri|real estate|property|residential|timber|farm/i.test(c.sector) && c.dqScore > 2)
    .map((c) => ({ cp: c, out: outstanding.get(c.id) ?? 0, gain: c.dqScore - 2 }))
    .map((x) => ({ ...x, score: (x.out * x.gain) / 1e6 }))
    .filter((x) => x.out > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return (
    <div className="cbz-grid cbz-grid--halves">
      <Panel title="MRV-verified borrowers" subtitle="Satellite NDVI and field visits feed these positions directly (A3, A5, A6)" padded={false}>
        {linked.length === 0 ? (
          <EmptyState title="No borrowers linked to MAvHU MRV yet." />
        ) : (
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Borrower</th>
                  <th className="cbz-num">ha</th>
                  <th>12-month NDVI</th>
                  <th className="cbz-num">Carbon stock</th>
                  <th>Field check</th>
                  <th>DQ</th>
                </tr>
              </thead>
              <tbody>
                {linked.map((m) => {
                  const drop = m.avgNdvi12m !== null && m.avgNdviPrior12m !== null ? m.avgNdvi12m - m.avgNdviPrior12m : null;
                  return (
                    <tr key={m.counterpartyId}>
                      <td>
                        {m.name}
                        <div className="cbz-muted">{fmtUsd(m.outstandingUsd)} outstanding · last pass {m.latestPass?.slice(0, 10) ?? '—'}</div>
                      </td>
                      <td className="cbz-num">{m.hectares.toLocaleString('en-GB')}</td>
                      <td>
                        {m.avgNdvi12m?.toFixed(2) ?? '—'}{' '}
                        {drop !== null && (
                          <span className={`cbz-pill ${drop < -0.03 ? 'cbz-pill--sev-high' : 'cbz-pill--sev-low'}`}>
                            {drop < -0.03 ? `▼ ${Math.abs(drop).toFixed(2)} stress` : `${drop >= 0 ? '▲' : '▼'} ${Math.abs(drop).toFixed(2)}`}
                          </span>
                        )}
                      </td>
                      <td className="cbz-num">{m.carbonStockTco2 ? `${fmtT(m.carbonStockTco2, 0)} t` : '—'}</td>
                      <td>{m.verificationStatus ?? '—'}</td>
                      <td>
                        <DqPill score={m.dqScore} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="MRV prioritisation" subtitle="Unverified land-based borrowers ranked by outstanding × DQ points MRV could save (A4)" padded={false}>
        {candidates.length === 0 ? (
          <EmptyState title="Every land-based borrower in scope is already MRV-verified or at DQ 2." />
        ) : (
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Borrower</th>
                  <th className="cbz-num">Outstanding</th>
                  <th>DQ now → with MRV</th>
                  <th className="cbz-num">Priority</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => (
                  <tr key={c.cp.id}>
                    <td>{i + 1}</td>
                    <td>
                      {c.cp.name}
                      <div className="cbz-muted">{c.cp.sector}</div>
                    </td>
                    <td className="cbz-num">{fmtUsd(c.out)}</td>
                    <td>
                      {c.cp.dqScore} → 2
                    </td>
                    <td className="cbz-num">{c.score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
