import { Fragment, useEffect, useMemo, useState } from 'react';
import { fetchAuditVerification, fetchEvidence } from '../../../model/cbz/cbz_api';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import { useCbz } from '../../../model/cbz/useCbz';
import type { AuditEntry, ChainVerification, EmissionRecord, EntityCode, EvidenceFile } from '../../../model/cbz/types';
import { EvidenceUploadModal } from '../components/EvidenceUpload';
import { EmptyState, Panel, StatCard, StatusBadge, fmtDateTime, fmtT } from '../components/primitives';
import { SimpleModal } from '../components/SimpleModal';

const FLOW: EmissionRecord['status'][] = ['draft', 'in_review', 'approved', 'locked'];

/** Draft → review → approved → locked, with segregation of duties and a tamper-evident trail (F18, F19). */
export function WorkflowTab({ scope }: { scope: EntityCode }) {
  const state = useCbz();
  const { advanceEmission, rejectEmission, can, me } = useCbzData();
  const [filter, setFilter] = useState<EmissionRecord['status'] | 'all'>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<EmissionRecord | null>(null);
  const [attaching, setAttaching] = useState<EmissionRecord | null>(null);
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);

  const loadEvidence = () => fetchEvidence({ targetType: 'EmissionRecord' }).then(setEvidence).catch(() => setEvidence([]));
  useEffect(() => {
    void loadEvidence();
  }, []);
  const evidenceCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of evidence) if (e.targetId) m.set(e.targetId, (m.get(e.targetId) ?? 0) + 1);
    return m;
  }, [evidence]);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  const inScope = useMemo(() => state.emissions.filter((r) => scope === 'GROUP' || r.entityCode === scope), [scope, state.emissions]);
  const records = useMemo(
    () => inScope.filter((r) => filter === 'all' || r.status === filter).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 200),
    [inScope, filter],
  );
  const counts = useMemo(() => {
    const c: Record<EmissionRecord['status'], number> = { draft: 0, in_review: 0, approved: 0, locked: 0 };
    for (const r of inScope) c[r.status] += 1;
    return c;
  }, [inScope]);

  const own = (r: EmissionRecord) => Boolean(me?.entityCode) && (me?.role === 'contributor' || me?.role === 'customer') ? r.entityCode === me?.entityCode : true;
  const mine = (r: EmissionRecord) => Boolean(me?.memberId) && r.submittedBy === me?.memberId;
  const nextAction = (r: EmissionRecord): string | null => {
    if (r.status === 'draft') return can('submit-data') && own(r) ? 'Submit for review' : null;
    if (r.status === 'in_review') return can('approve') && !mine(r) ? 'Approve' : null;
    if (r.status === 'approved') return can('approve') ? 'Lock' : null;
    return null;
  };

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        {FLOW.map((s) => (
          <StatCard
            key={s}
            label={s.replace('_', ' ')}
            value={String(counts[s])}
            hint={s === 'draft' ? 'Awaiting submission' : s === 'in_review' ? 'Awaiting an approver' : s === 'approved' ? 'Signed off; can be locked' : 'Read-only; assurance anchor'}
            intent={s === 'in_review' ? 'warning' : s === 'locked' ? 'positive' : 'neutral'}
          />
        ))}
      </div>

      <Panel
        title="Submission & approval workflow"
        subtitle="Segregation of duties: nobody approves their own submission. Locked periods reject changes. Every step is in the audit trail below."
        action={
          <label className="cbz-field cbz-field--inline">
            <span>Status</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All</option>
              {FLOW.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        }
        padded={false}
      >
        {actionError && <p className="cbz-alert cbz-alert--danger">{actionError}</p>}
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Scope</th>
                <th>Dataset</th>
                <th className="cbz-num">tCO2e</th>
                <th>Status</th>
                <th>Evidence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const action = nextAction(r);
                return (
                  <tr key={r.id}>
                    <td>{r.entityCode}</td>
                    <td>{r.scope.toUpperCase()}</td>
                    <td>
                      <div>{r.datasetType}</div>
                      <div className="cbz-muted">
                        {r.site} · {r.period}
                      </div>
                      {r.status === 'draft' && r.reviewNote && <div className="cbz-alert cbz-alert--info cbz-inline-note">Sent back: {r.reviewNote}</div>}
                    </td>
                    <td className="cbz-num">{fmtT(r.emissionsTco2e, 2)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                      {r.status === 'in_review' && mine(r) && <div className="cbz-muted">your submission</div>}
                    </td>
                    <td>
                      <button type="button" className="cbz-link" onClick={() => setAttaching(r)} disabled={!can('submit-data')}>
                        {evidenceCount.get(r.id) ? `${evidenceCount.get(r.id)} file(s)` : can('submit-data') ? '+ Attach' : '—'}
                      </button>
                    </td>
                    <td>
                      <div className="cbz-toolbar cbz-toolbar--end">
                        {r.status === 'in_review' && can('approve') && !mine(r) && (
                          <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => setRejecting(r)}>
                            Send back
                          </button>
                        )}
                        {action && (
                          <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--primary" onClick={() => run(() => advanceEmission(r.id))}>
                            {action}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="No records for this filter." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <AuditTrailPanel scope={scope} />

      {rejecting && (
        <SimpleModal
          title="Send back to the submitter"
          subtitle={`${rejecting.datasetType} · ${rejecting.period}`}
          submitLabel="Send back"
          fields={[{ key: 'reason', label: 'What needs fixing', textarea: true, required: true }]}
          onClose={() => setRejecting(null)}
          onSubmit={async (v) => {
            await rejectEmission(rejecting.id, v.reason);
            setRejecting(null);
          }}
        />
      )}
      {attaching && (
        <EvidenceUploadModal
          targetType="EmissionRecord"
          targetId={attaching.id}
          entityCode={attaching.entityCode}
          title={`Evidence for ${attaching.datasetType} (${attaching.period})`}
          onClose={() => setAttaching(null)}
          onUploaded={() => void loadEvidence()}
        />
      )}
    </>
  );
}

function AuditTrailPanel({ scope }: { scope: EntityCode }) {
  const state = useCbz();
  const [check, setCheck] = useState<ChainVerification | null>(null);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('all');

  async function verify() {
    setChecking(true);
    try {
      setCheck(await fetchAuditVerification());
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    void verify();
  }, []);

  const rows = state.audit
    .filter((a) => scope === 'GROUP' || a.entityCode === scope || a.entityCode === 'GROUP' || a.entityCode === null)
    .filter((a) => actionFilter === 'all' || a.action === actionFilter);
  const actions = [...new Set(state.audit.map((a) => a.action))].sort();

  function exportCsv() {
    const header = ['seq', 'timestamp', 'actor', 'action', 'entity', 'target_type', 'target_id', 'detail', 'before', 'after', 'prev_hash', 'hash'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((a) => [a.seq, a.timestamp, a.actor, a.action, a.entityCode, a.targetType, a.targetId, a.detail, a.before ? JSON.stringify(a.before) : '', a.after ? JSON.stringify(a.after) : '', a.prevHash, a.hash].map(esc).join(','));
    const url = URL.createObjectURL(new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel
      title="Tamper-evident audit trail"
      subtitle="Append-only and hash-chained: each entry seals the one before it. Expand a change to see old and new values (F18)."
      action={
        <div className="cbz-toolbar">
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} aria-label="Filter by action">
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button type="button" className="cbz-btn cbz-btn--ghost" onClick={verify} disabled={checking}>
            {checking ? 'Verifying…' : 'Verify chain'}
          </button>
          <button type="button" className="cbz-btn cbz-btn--ghost" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      }
      padded={false}
    >
      {check && (
        <p className={`cbz-alert cbz-alert--${check.intact ? 'success' : 'danger'}`}>
          {check.intact
            ? `Chain intact: all ${check.total} entries for this bank verified at ${fmtDateTime(check.checkedAt)}. Head hash ${check.headHash?.slice(0, 16)}…`
            : `Chain broken: ${check.broken.length} entr${check.broken.length === 1 ? 'y' : 'ies'} changed after being written (first: #${check.broken[0]?.seq}, ${check.broken[0]?.reason}).`}
        </p>
      )}
      <div className="cbz-table-wrap">
        <table className="cbz-table cbz-table--compact">
          <thead>
            <tr>
              <th>#</th>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Detail</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 60).map((a) => (
              <Fragment key={a.id}>
                <tr className={a.before || a.after ? 'cbz-row--clickable' : undefined} onClick={() => (a.before || a.after) && setOpen(open === a.id ? null : a.id)}>
                  <td className="cbz-mono">{a.seq}</td>
                  <td className="cbz-mono">{fmtDateTime(a.timestamp)}</td>
                  <td>{a.actor}</td>
                  <td>
                    <span className="cbz-chip cbz-chip--audit">{a.action}</span>
                  </td>
                  <td>
                    {a.detail}
                    {(a.before || a.after) && <span className="cbz-muted"> {open === a.id ? '▾' : '▸'} changes</span>}
                  </td>
                  <td className="cbz-mono cbz-muted" title={a.hash ?? ''}>
                    {a.hash?.slice(0, 10)}
                  </td>
                </tr>
                {open === a.id && (
                  <tr>
                    <td colSpan={6}>
                      <ChangeDiff entry={a} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="No audit entries yet." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const HIDDEN = new Set(['createdAt', 'updatedAt', 'submittedAt']);

function ChangeDiff({ entry }: { entry: AuditEntry }) {
  const keys = [...new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})])].filter((k) => !HIDDEN.has(k));
  const show = (v: unknown) => (v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const changed = keys.filter((k) => show(entry.before?.[k]) !== show(entry.after?.[k]));
  const list = entry.before && entry.after ? changed : keys;
  return (
    <table className="cbz-table cbz-table--compact cbz-diff">
      <thead>
        <tr>
          <th>Field</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        {list.map((k) => (
          <tr key={k}>
            <td className="cbz-mono">{k}</td>
            <td className="cbz-diff__old">{show(entry.before?.[k])}</td>
            <td className="cbz-diff__new">{show(entry.after?.[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
