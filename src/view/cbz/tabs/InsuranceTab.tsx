import { useMemo, useState } from 'react';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import { useCbz } from '../../../model/cbz/useCbz';
import { summariseInsurance } from '../../../model/cbz/calculators';
import type { EntityCode, InsurancePolicy } from '../../../model/cbz/types';
import { BarChart } from '../components/charts';
import { DqPill, Panel, StatCard, fmtT, fmtUsd, fmtPct } from '../components/primitives';

const SEGMENTS: InsurancePolicy['segment'][] = [
  'Commercial lines',
  'Personal motor - individual data',
  'Personal motor - PCAF fallback factor',
  'Project insurance',
  'Treaty reinsurance',
];

export function InsuranceTab({ scope }: { scope: EntityCode }) {
  const state = useCbz();
  const [showAdd, setShowAdd] = useState(false);

  const policies = useMemo(
    () => (scope === 'GROUP' ? state.insurance : state.insurance.filter((p) => p.subsidiary === scope)),
    [scope, state.insurance],
  );
  const summary = summariseInsurance(policies);

  const bySegment = useMemo(() => {
    const map = new Map<InsurancePolicy['segment'], { premium: number; emissions: number; count: number }>();
    for (const p of policies) {
      const cur = map.get(p.segment) ?? { premium: 0, emissions: 0, count: 0 };
      cur.premium += p.grossWrittenPremiumUsd;
      cur.emissions += p.insuranceAssociatedEmissions;
      cur.count += 1;
      map.set(p.segment, cur);
    }
    return [...map.entries()].map(([label, v]) => ({ label, ...v }));
  }, [policies]);

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Policies" value={String(summary.count)} hint="In scope" />
        <StatCard label="Gross written premium" value={fmtUsd(summary.totalPremium)} intent="positive" />
        <StatCard label="Insurance-associated" value={fmtT(summary.totalEmissions, 1)} unit="tCO2e" intent="warning" />
        <StatCard label="Weighted DQ" value={summary.weightedDq.toFixed(2)} intent={summary.weightedDq <= 3 ? 'positive' : 'warning'} />
      </div>

      <Panel
        title="Attribution by segment"
        subtitle="Attribution factor = Gross written premium ÷ denominator (client revenue, sum insured, ceded premium, or PCAF fallback)"
        action={
          <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setShowAdd(true)}>
            + Bind policy
          </button>
        }
      >
        <BarChart
          unit="tCO2e"
          ariaLabel="Insurance-associated emissions by segment"
          data={bySegment.map((s) => ({ label: s.label.replace('Personal motor - ', 'PM - '), value: +s.emissions.toFixed(2) }))}
        />
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Segment</th>
                <th>Policies</th>
                <th className="cbz-num">Gross premium</th>
                <th className="cbz-num">Attributed emissions</th>
              </tr>
            </thead>
            <tbody>
              {bySegment.map((s) => (
                <tr key={s.label}>
                  <td>{s.label}</td>
                  <td>{s.count}</td>
                  <td className="cbz-num">{fmtUsd(s.premium)}</td>
                  <td className="cbz-num">{fmtT(s.emissions, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Policies" subtitle="Insurance-associated emissions per policy (PCAF Part C, 2nd ed.)">
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Client</th>
                <th>Segment</th>
                <th className="cbz-num">Premium</th>
                <th className="cbz-num">Denominator</th>
                <th className="cbz-num">Attribution</th>
                <th className="cbz-num">Emissions</th>
                <th>DQ</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td className="cbz-mono">{p.id}</td>
                  <td>
                    <div>{p.clientName}</div>
                    <div className="cbz-muted">{p.sector}</div>
                  </td>
                  <td>{p.segment}</td>
                  <td className="cbz-num">{fmtUsd(p.grossWrittenPremiumUsd)}</td>
                  <td className="cbz-num">
                    {p.denominatorValueUsd ? (
                      fmtUsd(p.denominatorValueUsd)
                    ) : (
                      <span className="cbz-muted">PCAF fallback</span>
                    )}
                  </td>
                  <td className="cbz-num">{fmtPct(p.attributionFactor, 3)}</td>
                  <td className="cbz-num">{fmtT(p.insuranceAssociatedEmissions, 2)}</td>
                  <td>
                    <DqPill score={p.dqScore} />
                  </td>
                </tr>
              ))}
              {policies.length === 0 && (
                <tr>
                  <td colSpan={8} className="cbz-muted">
                    No policies in scope yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {showAdd && <BindPolicyModal scope={scope} onClose={() => setShowAdd(false)} />}
    </>
  );
}

function BindPolicyModal({ scope, onClose }: { scope: EntityCode; onClose: () => void }) {
  const { addInsurance } = useCbzData();
  const [segment, setSegment] = useState<InsurancePolicy['segment']>('Commercial lines');
  const [clientName, setClientName] = useState('');
  const [sector, setSector] = useState('');
  const [premium, setPremium] = useState('');
  const [denomValue, setDenomValue] = useState('');
  const [clientEmissions, setClientEmissions] = useState('');
  const [dqScore, setDqScore] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [error, setError] = useState<string | null>(null);

  const usesFallback = segment === 'Personal motor - PCAF fallback factor';

  function denomLabel(): string {
    switch (segment) {
      case 'Commercial lines':
        return "Client's total revenue (US$)";
      case 'Personal motor - individual data':
        return 'Annual vehicle ownership cost (US$)';
      case 'Personal motor - PCAF fallback factor':
        return 'PCAF fallback (6.99%, no denominator)';
      case 'Project insurance':
        return 'Insured value / project total E&D (US$)';
      case 'Treaty reinsurance':
        return 'Ceded premium share of cedant portfolio (US$)';
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const p = Number.parseFloat(premium);
    const emis = Number.parseFloat(clientEmissions);
    if (!clientName.trim()) {
      setError('Client name is required.');
      return;
    }
    if (!Number.isFinite(p) || p <= 0) {
      setError('Premium must be a positive number.');
      return;
    }
    if (!Number.isFinite(emis) || emis <= 0) {
      setError('Client total emissions must be a positive number.');
      return;
    }
    let denom: number | null = null;
    if (!usesFallback) {
      denom = Number.parseFloat(denomValue);
      if (!Number.isFinite(denom) || denom <= 0) {
        setError('Denominator value must be a positive number.');
        return;
      }
    }
    const attributionFactor = denom ? p / denom : 0.0699;
    try {
      await addInsurance({
        segment,
        subsidiary: scope === 'GROUP' ? 'CBZINS' : scope,
        clientId: `AD-HOC-${Date.now()}`,
        clientName: clientName.trim(),
        sector: sector.trim() || 'Not specified',
        grossWrittenPremiumUsd: p,
        denominatorType: denomLabel(),
        denominatorValueUsd: denom,
        clientTotalEmissions: emis,
        attributionFactor,
        insuranceAssociatedEmissions: attributionFactor * emis,
        dqScore,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save policy.');
    }
  }

  return (
    <div className="cbz-modal-backdrop" role="dialog" aria-modal="true">
      <div className="cbz-modal cbz-modal--wide">
        <header className="cbz-modal__head">
          <div>
            <h3>Bind insurance policy</h3>
            <p className="cbz-muted">PCAF Part C · attribution and emissions computed automatically.</p>
          </div>
          <button type="button" className="cbz-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form className="cbz-modal__body" onSubmit={submit}>
          <div className="cbz-grid cbz-grid--form">
            <label className="cbz-field">
              <span>Segment</span>
              <select value={segment} onChange={(e) => setSegment(e.target.value as InsurancePolicy['segment'])}>
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field">
              <span>Client name</span>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            </label>
            <label className="cbz-field">
              <span>Sector</span>
              <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Manufacturing" />
            </label>
            <label className="cbz-field">
              <span>Gross written premium (US$)</span>
              <input type="number" min={0} step={100} value={premium} onChange={(e) => setPremium(e.target.value)} required />
            </label>
            <label className="cbz-field">
              <span>{denomLabel()}</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={denomValue}
                onChange={(e) => setDenomValue(e.target.value)}
                disabled={usesFallback}
                placeholder={usesFallback ? 'Not required for PCAF fallback' : ''}
              />
            </label>
            <label className="cbz-field">
              <span>Client total emissions (tCO2e)</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={clientEmissions}
                onChange={(e) => setClientEmissions(e.target.value)}
                required
              />
            </label>
            <label className="cbz-field">
              <span>PCAF DQ score</span>
              <select value={dqScore} onChange={(e) => setDqScore(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    DQ {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
          <footer className="cbz-modal__foot">
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cbz-btn cbz-btn--primary">
              Bind policy
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
