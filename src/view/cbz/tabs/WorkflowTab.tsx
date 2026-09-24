import { useMemo, useState } from 'react';
import { useCbz } from '../../../model/cbz/useCbz';
import { cbzStore } from '../../../model/cbz/store';
import type { CbzSession, EmissionRecord, EntityCode } from '../../../model/cbz/types';
import { EmptyState, Panel, StatCard, StatusBadge, fmtDateTime, fmtT } from '../components/primitives';

const FLOW: EmissionRecord['status'][] = ['draft', 'in_review', 'approved', 'locked'];

export function WorkflowTab({ scope, session }: { scope: EntityCode; session: CbzSession }) {
  const state = useCbz();
  const [filter, setFilter] = useState<EmissionRecord['status'] | 'all'>('all');

  const records = useMemo(
    () =>
      state.emissions
        .filter((r) => scope === 'GROUP' || r.entityCode === scope)
        .filter((r) => filter === 'all' || r.status === filter)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [scope, state.emissions, filter],
  );

  const counts = useMemo(() => {
    const c: Record<EmissionRecord['status'], number> = { draft: 0, in_review: 0, approved: 0, locked: 0 };
    for (const r of state.emissions.filter((r) => scope === 'GROUP' || r.entityCode === scope)) {
      c[r.status] += 1;
    }
    return c;
  }, [state.emissions, scope]);

  const canAdvance = (r: EmissionRecord): boolean => {
    if (r.status === 'locked') return false;
    if (session.role === 'admin') return true;
    if (session.role === 'approver' && (r.status === 'in_review' || r.status === 'approved')) return true;
    if (session.role === 'contributor' && r.status === 'draft') return true;
    return false;
  };

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        {FLOW.map((s) => (
          <StatCard
            key={s}
            label={s.replace('_', ' ')}
            value={String(counts[s])}
            hint={
              s === 'draft'
                ? 'Awaiting contributor to submit'
                : s === 'in_review'
                ? 'Awaiting approver'
                : s === 'approved'
                ? 'Signed off; unlockable'
                : 'Read-only; audit anchor'
            }
            intent={s === 'draft' ? 'warning' : s === 'locked' ? 'positive' : 'neutral'}
          />
        ))}
      </div>

      <Panel
        title="Emissions workflow"
        subtitle="Draft → In review → Approved → Locked. Advancement is role-gated per RFP F18/F19."
        action={
          <label className="cbz-field cbz-field--inline">
            <span>Filter</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All statuses</option>
              {FLOW.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Record</th>
                <th>Entity</th>
                <th>Scope</th>
                <th>Dataset</th>
                <th className="cbz-num">Emissions</th>
                <th>Status</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="cbz-mono">{r.id}</td>
                  <td>{r.entityCode}</td>
                  <td>{r.scope.toUpperCase()}</td>
                  <td>
                    <div>{r.datasetType}</div>
                    <div className="cbz-muted">{r.site} · {r.period}</div>
                  </td>
                  <td className="cbz-num">{fmtT(r.emissionsTco2e, 2)} tCO2e</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>{fmtDateTime(r.submittedAt)}</td>
                  <td>
                    {canAdvance(r) && (
                      <button
                        type="button"
                        className="cbz-btn cbz-btn--sm cbz-btn--primary"
                        onClick={() => cbzStore.advanceEmissionStatus(r.id, session.fullName)}
                      >
                        Advance →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="No records for this filter." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Audit trail" subtitle="Append-only. Every mutation writes here. Filter by scope.">
        <div className="cbz-table-wrap">
          <table className="cbz-table cbz-table--compact">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {state.audit
                .filter((a) => scope === 'GROUP' || a.entityCode === scope || a.entityCode === 'GROUP' || a.entityCode === null)
                .slice(0, 20)
                .map((a) => (
                  <tr key={a.id}>
                    <td className="cbz-mono">{fmtDateTime(a.timestamp)}</td>
                    <td>{a.actor}</td>
                    <td>
                      <span className="cbz-chip cbz-chip--audit">{a.action}</span>
                    </td>
                    <td>{a.detail}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
