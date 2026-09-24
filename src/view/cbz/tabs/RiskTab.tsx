import { useMemo, useState } from 'react';
import { useCbz } from '../../../model/cbz/useCbz';
import { cbzStore } from '../../../model/cbz/store';
import type { CbzSession, EntityCode, RiskEntry } from '../../../model/cbz/types';
import { Panel, RiskChip, StatCard } from '../components/primitives';

function severity(likelihood: number, impact: number): 'low' | 'medium' | 'high' | 'critical' {
  const score = likelihood * impact;
  if (score <= 4) return 'low';
  if (score <= 9) return 'medium';
  if (score <= 16) return 'high';
  return 'critical';
}

export function RiskTab({ scope, session }: { scope: EntityCode; session: CbzSession }) {
  const state = useCbz();
  const [showAdd, setShowAdd] = useState(false);
  const canWrite = session.role !== 'reader' && session.role !== 'customer';

  const risks = useMemo(
    () => (scope === 'GROUP' ? state.risks : state.risks.filter((r) => r.linkedEntity === scope || r.linkedEntity === 'GROUP')),
    [scope, state.risks],
  );

  const stats = useMemo(() => {
    const counts = { Physical: 0, Transition: 0, Liability: 0, Opportunity: 0 };
    for (const r of risks) counts[r.category] += 1;
    return counts;
  }, [risks]);

  const cells: Array<{ likelihood: number; impact: number; risks: RiskEntry[] }> = [];
  for (let impact = 5; impact >= 1; impact--) {
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      cells.push({ likelihood, impact, risks: risks.filter((r) => r.likelihood === likelihood && r.impact === impact) });
    }
  }

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Total risks" value={String(risks.length)} hint="In scope" intent="neutral" />
        <StatCard label="Physical" value={String(stats.Physical)} hint="Climate hazards on assets" intent="warning" />
        <StatCard label="Transition" value={String(stats.Transition)} hint="Policy, tech, market" intent="warning" />
        <StatCard label="Opportunity" value={String(stats.Opportunity)} hint="Green products & finance" intent="positive" />
      </div>

      <Panel
        title="Risk heat map"
        subtitle="Likelihood × Impact — risks are plotted, not just coloured; multiple risks stack in one cell"
        action={
          canWrite && (
            <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setShowAdd(true)}>
              + Add risk
            </button>
          )
        }
      >
        <div className="cbz-heatmap">
          <div className="cbz-heatmap__axis-y">Impact</div>
          <div className="cbz-heatmap__grid">
            {cells.map((cell) => (
              <div
                key={`${cell.likelihood}-${cell.impact}`}
                className={`cbz-heatmap__cell cbz-heatmap__cell--${severity(cell.likelihood, cell.impact)}`}
              >
                <div className="cbz-heatmap__coord">
                  L{cell.likelihood}·I{cell.impact}
                </div>
                <div className="cbz-heatmap__markers">
                  {cell.risks.map((r) => (
                    <span key={r.id} className="cbz-heatmap__dot" title={`${r.id}: ${r.title}`}>
                      {r.id.replace('RSK-', '')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="cbz-heatmap__axis-x">Likelihood →</div>
        </div>
      </Panel>

      <Panel title="Register" subtitle="All entries in scope">
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Entity</th>
                <th>Owner</th>
                <th>L×I</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.id}>
                  <td className="cbz-mono">{r.id}</td>
                  <td>{r.title}</td>
                  <td>
                    <RiskChip category={r.category} />
                  </td>
                  <td>{r.linkedEntity}</td>
                  <td>{r.owner}</td>
                  <td>
                    <span className={`cbz-pill cbz-pill--sev-${severity(r.likelihood, r.impact)}`}>
                      L{r.likelihood} × I{r.impact}
                    </span>
                  </td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {showAdd && <AddRiskModal onClose={() => setShowAdd(false)} scope={scope} actor={session.fullName} />}
    </>
  );
}

function AddRiskModal({ onClose, scope, actor }: { onClose: () => void; scope: EntityCode; actor: string }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RiskEntry['category']>('Physical');
  const [likelihood, setLikelihood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [impact, setImpact] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState<RiskEntry['status']>('Identified');
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    cbzStore.addRisk(
      {
        title: title.trim(),
        category,
        likelihood,
        impact,
        owner: owner.trim() || 'Unassigned',
        status,
        linkedEntity: scope === 'GROUP' ? 'GROUP' : scope,
      },
      actor,
    );
    onClose();
  }

  return (
    <div className="cbz-modal-backdrop" role="dialog" aria-modal="true">
      <div className="cbz-modal">
        <header className="cbz-modal__head">
          <div>
            <h3>Add risk register entry</h3>
            <p className="cbz-muted">L × I = severity zone on the heatmap.</p>
          </div>
          <button type="button" className="cbz-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form className="cbz-modal__body" onSubmit={submit}>
          <label className="cbz-field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <div className="cbz-grid cbz-grid--form">
            <label className="cbz-field">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as RiskEntry['category'])}>
                {(['Physical', 'Transition', 'Liability', 'Opportunity'] as const).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field">
              <span>Owner</span>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Risk owner" />
            </label>
            <label className="cbz-field">
              <span>Likelihood (1–5)</span>
              <select value={likelihood} onChange={(e) => setLikelihood(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="cbz-field">
              <span>Impact (1–5)</span>
              <select value={impact} onChange={(e) => setImpact(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="cbz-field">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as RiskEntry['status'])}>
                {(['Identified', 'Mitigating', 'Monitoring', 'Closed'] as const).map((s) => (
                  <option key={s} value={s}>
                    {s}
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
              Save risk
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
