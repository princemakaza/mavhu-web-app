import { useMemo, useState } from 'react';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import { useCbz } from '../../../model/cbz/useCbz';
import type { EntityCode, Incident, RiskEntry } from '../../../model/cbz/types';
import { EmptyState, Panel, RiskChip, StatCard } from '../components/primitives';
import { SimpleModal } from '../components/SimpleModal';

const CATEGORIES: RiskEntry['category'][] = ['Physical', 'Transition', 'Liability', 'Opportunity', 'Social', 'Governance'];
const STATUSES: RiskEntry['status'][] = ['Identified', 'Mitigating', 'Monitoring', 'Closed'];

function severity(likelihood: number, impact: number): 'low' | 'medium' | 'high' | 'critical' {
  const score = likelihood * impact;
  if (score <= 4) return 'low';
  if (score <= 9) return 'medium';
  if (score <= 16) return 'high';
  return 'critical';
}

export function RiskTab({ scope }: { scope: EntityCode }) {
  const state = useCbz();
  const { can } = useCbzData();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<RiskEntry | null>(null);
  const canWrite = can('write-data');

  const risks = useMemo(
    () => (scope === 'GROUP' ? state.risks : state.risks.filter((r) => r.linkedEntity === scope || r.linkedEntity === 'GROUP')),
    [scope, state.risks],
  );
  // Short, stable numbers shared by the heat map dots and the register rows.
  const number = useMemo(() => new Map(risks.map((r, i) => [r.id, i + 1])), [risks]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of risks) counts[r.category] = (counts[r.category] ?? 0) + 1;
    return counts;
  }, [risks]);

  const cells: Array<{ likelihood: number; impact: number; risks: RiskEntry[] }> = [];
  for (let impact = 5; impact >= 1; impact--) {
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      cells.push({ likelihood, impact, risks: risks.filter((r) => r.likelihood === likelihood && r.impact === impact && r.status !== 'Closed') });
    }
  }

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Open risks" value={String(risks.filter((r) => r.status !== 'Closed').length)} hint={`${risks.length} on the register`} />
        <StatCard label="Physical · transition" value={`${stats.Physical ?? 0} · ${stats.Transition ?? 0}`} hint="IFRS S2 climate risks" intent="warning" />
        <StatCard label="Social · governance" value={`${stats.Social ?? 0} · ${stats.Governance ?? 0}`} hint="Wider ESG register (F32)" />
        <StatCard label="Opportunities" value={String(stats.Opportunity ?? 0)} hint="Green products & finance" intent="positive" />
      </div>

      <Panel
        title="Risk heat map"
        subtitle="Likelihood × impact. Numbers match the register below; re-rating a risk moves it here."
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
              <div key={`${cell.likelihood}-${cell.impact}`} className={`cbz-heatmap__cell cbz-heatmap__cell--${severity(cell.likelihood, cell.impact)}`}>
                <div className="cbz-heatmap__coord">
                  L{cell.likelihood}·I{cell.impact}
                </div>
                <div className="cbz-heatmap__markers">
                  {cell.risks.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="cbz-heatmap__dot"
                      title={`#${number.get(r.id)} ${r.title} (${r.category})`}
                      onClick={() => canWrite && setEditing(r)}
                    >
                      {number.get(r.id)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="cbz-heatmap__axis-x">Likelihood →</div>
        </div>
      </Panel>

      <Panel title="Climate & ESG risk register" subtitle="Physical, transition, liability, social, governance and opportunity entries (F29, F32)" padded={false}>
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Risk</th>
                <th>Category</th>
                <th>Entity</th>
                <th>Owner</th>
                <th>L×I</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.id}>
                  <td className="cbz-mono">{number.get(r.id)}</td>
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
                  <td>
                    {canWrite && (
                      <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => setEditing(r)}>
                        Re-rate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {risks.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="No risks on the register yet." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <IncidentsPanel scope={scope} />

      {showAdd && <AddRiskModal onClose={() => setShowAdd(false)} scope={scope} />}
      {editing && <EditRiskModal risk={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function IncidentsPanel({ scope }: { scope: EntityCode }) {
  const state = useCbz();
  const { can, updateIncident, addIncident } = useCbzData();
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<Incident | null>(null);
  const [reporting, setReporting] = useState(false);
  const canWrite = can('write-data');
  const incidents = state.incidents.filter((i) => scope === 'GROUP' || i.subsidiary === scope);

  async function move(incident: Incident, status: Incident['status']) {
    setError(null);
    try {
      await updateIncident(incident.id, { status });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the incident');
    }
  }

  return (
    <Panel
      title="ESG incidents"
      subtitle="Log an incident and take it through to closure with a corrective action (F27)"
      action={
        canWrite && (
          <button type="button" className="cbz-btn cbz-btn--ghost" onClick={() => setReporting(true)}>
            + Report incident
          </button>
        )
      }
      padded={false}
    >
      {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
      <div className="cbz-table-wrap">
        <table className="cbz-table cbz-table--compact">
          <thead>
            <tr>
              <th>Reported</th>
              <th>Entity</th>
              <th>Category</th>
              <th>Description</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Corrective action</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id}>
                <td className="cbz-mono">{i.dateReported}</td>
                <td>{i.subsidiary}</td>
                <td>{i.category}</td>
                <td>{i.description}</td>
                <td>
                  <span className={`cbz-pill cbz-pill--sev-${i.severity.toLowerCase()}`}>{i.severity}</span>
                </td>
                <td>
                  <span className={`cbz-badge cbz-badge--incident-${i.status.toLowerCase().replace(' ', '')}`}>{i.status}</span>
                  {i.closureDate && <div className="cbz-muted">closed {i.closureDate}</div>}
                </td>
                <td className="cbz-muted">{i.correctiveAction || '—'}</td>
                <td>
                  {canWrite && i.status === 'Open' && (
                    <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => move(i, 'In Progress')}>
                      Start
                    </button>
                  )}
                  {canWrite && i.status !== 'Closed' && (
                    <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--primary" onClick={() => setClosing(i)}>
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {incidents.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState title="No incidents in scope." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {closing && (
        <SimpleModal
          title="Close incident"
          subtitle={closing.description}
          submitLabel="Close incident"
          fields={[{ key: 'correctiveAction', label: 'Corrective action taken', initial: closing.correctiveAction, textarea: true, required: true }]}
          onClose={() => setClosing(null)}
          onSubmit={async (v) => {
            await updateIncident(closing.id, { status: 'Closed', correctiveAction: v.correctiveAction });
            setClosing(null);
          }}
        />
      )}
      {reporting && (
        <SimpleModal
          title="Report an ESG incident"
          submitLabel="Report"
          fields={[
            { key: 'subsidiary', label: 'Subsidiary', options: state.entities.map((e) => e.code), initial: scope === 'GROUP' ? state.entities[0]?.code : scope, required: true },
            { key: 'category', label: 'Category', options: ['Environmental', 'Social', 'Governance', 'Compliance'], initial: 'Environmental', required: true },
            { key: 'severity', label: 'Severity', options: ['Low', 'Medium', 'High', 'Critical'], initial: 'Medium', required: true },
            { key: 'dateReported', label: 'Date reported', type: 'date', initial: new Date().toISOString().slice(0, 10), required: true },
            { key: 'description', label: 'What happened', textarea: true, required: true },
          ]}
          onClose={() => setReporting(false)}
          onSubmit={async (v) => {
            await addIncident({ ...v, status: 'Open', correctiveAction: '', closureDate: null } as Partial<Incident>);
            setReporting(false);
          }}
        />
      )}
    </Panel>
  );
}

function EditRiskModal({ risk, onClose }: { risk: RiskEntry; onClose: () => void }) {
  const { updateRisk } = useCbzData();
  return (
    <SimpleModal
      title={`Re-rate: ${risk.title}`}
      subtitle="The heat map moves as soon as you save. The previous rating stays in the audit trail."
      submitLabel="Save rating"
      fields={[
        { key: 'likelihood', label: 'Likelihood (1-5)', options: ['1', '2', '3', '4', '5'], initial: String(risk.likelihood), required: true },
        { key: 'impact', label: 'Impact (1-5)', options: ['1', '2', '3', '4', '5'], initial: String(risk.impact), required: true },
        { key: 'status', label: 'Status', options: STATUSES, initial: risk.status, required: true },
        { key: 'owner', label: 'Owner', initial: risk.owner, required: true },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        await updateRisk(risk.id, { likelihood: Number(v.likelihood), impact: Number(v.impact), status: v.status, owner: v.owner });
        onClose();
      }}
    />
  );
}

function AddRiskModal({ onClose, scope }: { onClose: () => void; scope: EntityCode }) {
  const { addRisk } = useCbzData();
  return (
    <SimpleModal
      title="Add a risk or opportunity"
      subtitle="Likelihood × impact places it on the heat map."
      submitLabel="Save risk"
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'category', label: 'Category', options: CATEGORIES, initial: 'Physical', required: true },
        { key: 'owner', label: 'Owner', required: true },
        { key: 'likelihood', label: 'Likelihood (1-5)', options: ['1', '2', '3', '4', '5'], initial: '3', required: true },
        { key: 'impact', label: 'Impact (1-5)', options: ['1', '2', '3', '4', '5'], initial: '3', required: true },
        { key: 'status', label: 'Status', options: STATUSES, initial: 'Identified', required: true },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        await addRisk({
          title: v.title,
          category: v.category as RiskEntry['category'],
          likelihood: Number(v.likelihood) as RiskEntry['likelihood'],
          impact: Number(v.impact) as RiskEntry['impact'],
          owner: v.owner,
          status: v.status as RiskEntry['status'],
          linkedEntity: scope === 'GROUP' ? 'GROUP' : scope,
        });
        onClose();
      }}
    />
  );
}
