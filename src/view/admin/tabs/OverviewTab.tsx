import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../../model/admin/adminApi';
import type { BankStats } from '../../../model/admin/types';
import { EmptyState, Panel, StatCard, fmtPct, fmtT, fmtUsd } from '../../cbz/components/primitives';
import { BankStatusBadge, ErrorNote, Loading, relativeTime } from '../shared';
import { useLoad } from '../useLoad';

type Tab = 'banks' | 'users' | 'periods' | 'audit';

/** Things a MAvHU admin should act on, derived from each bank's KPIs. */
function attentionItems(banks: BankStats[]): Array<{ bank: BankStats; text: string }> {
  const items: Array<{ bank: BankStats; text: string }> = [];
  for (const bank of banks) {
    if (bank.status === 'onboarding' && bank.entities === 0) items.push({ bank, text: 'Onboarding: no subsidiaries set up yet' });
    if (bank.status !== 'suspended' && bank.entities > 0 && bank.activeMembers === 0) items.push({ bank, text: 'No active users can sign in' });
    if (bank.inReview > 0) items.push({ bank, text: `${bank.inReview} emission record(s) waiting for approval` });
    if (bank.highRisks > 0) items.push({ bank, text: `${bank.highRisks} high-rated climate risk(s) on the register` });
    if (bank.openIncidents > 0) items.push({ bank, text: `${bank.openIncidents} open ESG incident(s)` });
    const idleDays = bank.lastActivity ? (Date.now() - new Date(bank.lastActivity).getTime()) / 86_400_000 : Infinity;
    if (bank.status === 'active' && idleDays > 14) items.push({ bank, text: 'No activity in the last 14 days' });
  }
  return items;
}

export function OverviewTab({ onOpenTab }: { onOpenTab: (tab: Tab) => void }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => adminApi.overview(), []);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;

  const { totals, banks } = data;
  const attention = attentionItems(banks);
  const signedOffShare = totals.emissionRecords ? totals.signedOff / totals.emissionRecords : 0;

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Client banks" value={String(totals.banks)} hint={`${totals.activeBanks} active · ${totals.onboardingBanks} onboarding`} />
        <StatCard label="Subsidiaries" value={String(totals.entities)} hint="Legal entities reporting" />
        <StatCard label="Bank users" value={String(totals.activeMembers)} hint={`${totals.members - totals.activeMembers} deactivated`} intent="positive" />
        <StatCard label="Awaiting approval" value={String(totals.inReview)} hint={`${totals.drafts} still in draft`} intent={totals.inReview ? 'warning' : 'neutral'} />
        <StatCard label="Data signed off" value={fmtPct(signedOffShare, 0)} hint={`${totals.signedOff} of ${totals.emissionRecords} records`} intent="positive" />
        <StatCard label="Operational emissions" value={fmtT(totals.operationalTco2e)} unit="tCO2e" hint="Scope 1–3, all banks" />
        <StatCard label="Financed exposure" value={fmtUsd(totals.financedExposureUsd)} hint="Outstanding, PCAF Part A" />
        <StatCard label="Open incidents" value={String(totals.openIncidents)} hint={`${totals.highRisks} high-rated risks`} intent={totals.openIncidents ? 'negative' : 'neutral'} />
      </div>

      <Panel title="Needs attention" subtitle="Generated from each bank's live data.">
        {attention.length === 0 ? (
          <EmptyState title="Nothing needs attention right now." />
        ) : (
          <ul className="cbz-attention">
            {attention.map((item, i) => (
              <li key={`${item.bank.id}-${i}`}>
                <span>
                  <strong>{item.bank.name}</strong> · {item.text}
                </span>
                {item.bank.entities === 0 ? (
                  <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => onOpenTab('banks')}>
                    Set up bank
                  </button>
                ) : (
                  <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => navigate(`/admin/banks/${item.bank.id}/dashboard`)}>
                    Open dashboard
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Client banks"
        subtitle="Open a bank's dashboard to see exactly what its users see, with admin rights."
        action={
          <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => onOpenTab('banks')}>
            Manage banks
          </button>
        }
        padded={false}
      >
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Bank</th>
                <th>Status</th>
                <th className="cbz-num">Subsidiaries</th>
                <th className="cbz-num">Users</th>
                <th>Data signed off</th>
                <th className="cbz-num">Avg DQ</th>
                <th className="cbz-num">Financed exposure</th>
                <th className="cbz-num">Open incidents</th>
                <th>Last activity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {banks.map((bank) => {
                const share = bank.emissionRecords ? bank.signedOff / bank.emissionRecords : 0;
                return (
                  <tr key={bank.id}>
                    <td>
                      <div>{bank.name}</div>
                      <div className="cbz-mono cbz-muted">{bank.identifier}</div>
                    </td>
                    <td>
                      <BankStatusBadge status={bank.status} />
                    </td>
                    <td className="cbz-num">{bank.entities}</td>
                    <td className="cbz-num">{bank.activeMembers}</td>
                    <td>
                      <div className="cbz-progress" title={`${bank.signedOff} of ${bank.emissionRecords}`}>
                        <span style={{ inlineSize: `${share * 100}%` }} />
                      </div>
                      <div className="cbz-muted">
                        {bank.signedOff}/{bank.emissionRecords} · {bank.inReview} in review
                      </div>
                    </td>
                    <td className="cbz-num">{bank.avgDataQuality ? bank.avgDataQuality.toFixed(1) : '—'}</td>
                    <td className="cbz-num">{fmtUsd(bank.financedExposureUsd)}</td>
                    <td className="cbz-num">{bank.openIncidents}</td>
                    <td className="cbz-muted">{relativeTime(bank.lastActivity)}</td>
                    <td>
                      <button
                        type="button"
                        className="cbz-btn cbz-btn--sm cbz-btn--primary"
                        disabled={bank.entities === 0}
                        title={bank.entities === 0 ? 'Add a subsidiary first' : undefined}
                        onClick={() => navigate(`/admin/banks/${bank.id}/dashboard`)}
                      >
                        Open dashboard
                      </button>
                    </td>
                  </tr>
                );
              })}
              {banks.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <EmptyState title="No banks onboarded yet." hint="Use Banks → Onboard bank." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
