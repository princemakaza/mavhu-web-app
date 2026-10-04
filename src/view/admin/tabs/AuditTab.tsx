import { useMemo, useState } from 'react';
import { adminApi } from '../../../model/admin/adminApi';
import type { AuditRow } from '../../../model/admin/types';
import { EmptyState, Panel, fmtDateTime } from '../../cbz/components/primitives';
import { ErrorNote, Loading } from '../shared';
import { useLoad } from '../useLoad';

function toCsv(rows: AuditRow[]): string {
  const header = ['timestamp', 'bank', 'actor', 'action', 'entity', 'target_type', 'target_id', 'detail'];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [r.timestamp, r.bankName, r.actor, r.action, r.entityCode, r.targetType, r.targetId, r.detail].map(escape).join(','));
  return [header.join(','), ...lines].join('\n');
}

export function AuditTab() {
  const banks = useLoad(() => adminApi.banks(), []);
  const [bankId, setBankId] = useState(0);
  const audit = useLoad(() => adminApi.audit(bankId || undefined, 1000), [bankId]);
  const [action, setAction] = useState('all');
  const [search, setSearch] = useState('');

  const actions = useMemo(() => [...new Set((audit.data ?? []).map((r) => r.action))].sort(), [audit.data]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (audit.data ?? []).filter(
      (r) => (action === 'all' || r.action === action) && (!term || `${r.actor} ${r.detail} ${r.targetId ?? ''} ${r.entityCode ?? ''}`.toLowerCase().includes(term)),
    );
  }, [audit.data, action, search]);

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mavhu-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel
      title="Audit trail"
      subtitle="Every bank's change log plus MAvHU admin actions, newest first (RFP F18). Export what you are viewing as CSV."
      action={
        <div className="cbz-toolbar">
          <label className="cbz-field cbz-field--inline">
            <span>Bank</span>
            <select value={bankId} onChange={(e) => setBankId(Number(e.target.value))}>
              <option value={0}>All banks</option>
              {(banks.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="cbz-field cbz-field--inline">
            <span>Action</span>
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="cbz-field cbz-field--inline">
            <span>Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Actor, detail, record" />
          </label>
          <button type="button" className="cbz-btn cbz-btn--ghost" onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV ({rows.length})
          </button>
        </div>
      }
      padded={false}
    >
      {audit.error && <ErrorNote message={audit.error} onRetry={audit.reload} />}
      {audit.loading && !audit.data ? (
        <Loading />
      ) : (
        <div className="cbz-table-wrap">
          <table className="cbz-table cbz-table--compact">
            <thead>
              <tr>
                <th>When</th>
                <th>Bank</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cbz-muted">{fmtDateTime(r.timestamp)}</td>
                  <td>{r.bankName}</td>
                  <td>{r.actor}</td>
                  <td>
                    <span className="cbz-chip cbz-chip--audit">{r.action}</span>
                  </td>
                  <td>
                    <div>{r.targetType}</div>
                    <div className="cbz-mono cbz-muted">{[r.entityCode, r.targetId].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td>{r.detail}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No audit entries match." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
