import { useMemo, useState } from 'react';
import { adminApi } from '../../../model/admin/adminApi';
import type { PeriodRow } from '../../../model/admin/types';
import { Panel, fmtDateTime } from '../../cbz/components/primitives';
import { ErrorNote, Loading } from '../shared';
import { useLoad } from '../useLoad';

/** The last six quarters, newest first, e.g. 2026-Q4 … 2025-Q3. */
function recentQuarters(count = 6): string[] {
  const now = new Date();
  let year = now.getFullYear();
  let quarter = Math.floor(now.getMonth() / 3) + 1;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(`${year}-Q${quarter}`);
    quarter -= 1;
    if (quarter === 0) {
      quarter = 4;
      year -= 1;
    }
  }
  return out;
}

export function PeriodsTab() {
  const banks = useLoad(() => adminApi.banks(), []);
  const periods = useLoad(() => adminApi.periods(), []);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const quarters = useMemo(() => {
    const stored = (periods.data ?? []).map((p) => p.period);
    return [...new Set([...recentQuarters(), ...stored])].sort().reverse();
  }, [periods.data]);

  const lookup = useMemo(() => {
    const map = new Map<string, PeriodRow>();
    for (const p of periods.data ?? []) map.set(`${p.bankId}:${p.period}`, p);
    return map;
  }, [periods.data]);

  async function setStatus(bankId: number, bankName: string, period: string, status: 'open' | 'locked') {
    setBusy(`${bankId}:${period}`);
    setMessage(null);
    try {
      await adminApi.setPeriod({ bankId, period, status });
      await periods.reload();
      setMessage({ kind: 'success', text: `${bankName} ${period} ${status === 'locked' ? 'locked' : 'reopened'}.` });
    } catch (err) {
      setMessage({ kind: 'danger', text: err instanceof Error ? err.message : 'Could not update the period.' });
    } finally {
      setBusy(null);
    }
  }

  const activeBanks = (banks.data ?? []).filter((b) => b.entities > 0);
  const columns = custom && /^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/.test(custom) && !quarters.includes(custom) ? [custom, ...quarters] : quarters;

  return (
    <Panel
      title="Reporting period locks"
      subtitle="Locking a period freezes it for assurance (RFP F19/F38): the bank can no longer add, advance or bulk-import records for it. Locking a quarter also covers its months."
      action={
        <label className="cbz-field cbz-field--inline">
          <span>Another period</span>
          <input value={custom} onChange={(e) => setCustom(e.target.value.toUpperCase())} placeholder="2026-08 or 2025-Q2" maxLength={7} />
        </label>
      }
      padded={false}
    >
      {(banks.error || periods.error) && <ErrorNote message={banks.error ?? periods.error ?? ''} onRetry={periods.reload} />}
      {message && <p className={`cbz-alert cbz-alert--${message.kind}`}>{message.text}</p>}
      {!banks.data || !periods.data ? (
        <Loading />
      ) : (
        <div className="cbz-table-wrap">
          <table className="cbz-table cbz-table--compact">
            <thead>
              <tr>
                <th>Bank</th>
                {columns.map((q) => (
                  <th key={q}>{q}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeBanks.map((bank) => (
                <tr key={bank.id}>
                  <td>{bank.name}</td>
                  {columns.map((q) => {
                    const row = lookup.get(`${bank.id}:${q}`);
                    const locked = row?.status === 'locked';
                    return (
                      <td key={q} title={locked && row?.lockedAt ? `Locked by ${row.lockedBy} on ${fmtDateTime(row.lockedAt)}` : undefined}>
                        <button
                          type="button"
                          className={`cbz-btn cbz-btn--sm ${locked ? 'cbz-btn--primary' : 'cbz-btn--ghost'}`}
                          disabled={busy === `${bank.id}:${q}`}
                          onClick={() => setStatus(bank.id, bank.name, q, locked ? 'open' : 'locked')}
                        >
                          {locked ? 'Locked · reopen' : 'Open · lock'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
