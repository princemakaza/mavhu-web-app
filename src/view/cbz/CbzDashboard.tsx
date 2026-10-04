import { useMemo, useState } from 'react';
import { useCbzData } from '../../model/cbz/CbzDataContext';
import type { CbzSession, EntityCode } from '../../model/cbz/types';
import { useCbz } from '../../model/cbz/useCbz';
import { cbzSession as sessionStore } from '../../model/cbz/session';
import { SnapshotTab } from './tabs/SnapshotTab';
import { PortfolioTab } from './tabs/PortfolioTab';
import { InsuranceTab } from './tabs/InsuranceTab';
import { RiskTab } from './tabs/RiskTab';
import { PredictiveTab } from './tabs/PredictiveTab';
import { WorkflowTab } from './tabs/WorkflowTab';
import { EntityTab } from './tabs/EntityTab';
import { DataEntryTab } from './tabs/DataEntryTab';
import { MembersTab } from './tabs/MembersTab';
import { ThemeToggle } from './components/ThemeToggle';

type TabKey =
  | 'snapshot'
  | 'portfolio'
  | 'insurance'
  | 'risk'
  | 'predictive'
  | 'workflow'
  | 'entity'
  | 'data-entry'
  | 'members';

interface TabDef {
  key: TabKey;
  label: string;
  description: string;
  roles: Array<CbzSession['role']>;
}

// auditor is the RFP F19/F38 assurer: every read-only view, no data entry or member admin.
const TABS: TabDef[] = [
  { key: 'snapshot', label: 'Group snapshot', description: 'Consolidated Group ESG picture', roles: ['admin', 'approver', 'reader', 'auditor'] },
  { key: 'portfolio', label: 'Financed emissions', description: 'PCAF Part A · all asset classes', roles: ['admin', 'approver', 'contributor', 'reader', 'auditor'] },
  { key: 'insurance', label: 'Insurance emissions', description: 'PCAF Part C · insurance-associated', roles: ['admin', 'approver', 'contributor', 'reader', 'auditor'] },
  { key: 'risk', label: 'Risk heatmap', description: 'Physical, transition & opportunity', roles: ['admin', 'approver', 'contributor', 'reader', 'auditor'] },
  { key: 'predictive', label: 'Predictive', description: 'Forecast + anomaly (simplified)', roles: ['admin', 'approver', 'reader', 'auditor'] },
  { key: 'workflow', label: 'Workflow', description: 'Draft → review → approved → locked', roles: ['admin', 'approver', 'contributor', 'auditor'] },
  { key: 'entity', label: 'My entity', description: 'Your subsidiary in detail', roles: ['admin', 'approver', 'contributor', 'reader', 'auditor', 'customer'] },
  { key: 'data-entry', label: 'Data entry', description: 'Upload file or manual form', roles: ['admin', 'approver', 'contributor', 'customer'] },
  { key: 'members', label: 'Members & customers', description: 'Onboard staff and clients', roles: ['admin', 'approver'] },
];

interface Props {
  session: CbzSession;
  onSignOut: () => void;
  /** Set when a MAvHU admin opens this bank's dashboard from the admin console. */
  adminView?: { onExit: () => void };
}

/** "CBZ Holdings" → "CBZ", "Stanbic Bank Zimbabwe" → "STA". */
function bankMark(name: string): string {
  const first = name.split(/\s+/)[0] ?? '';
  return (first.length <= 4 ? first : first.slice(0, 3)).toUpperCase();
}

export function CbzDashboard({ session, onSignOut, adminView }: Props) {
  const state = useCbz();
  const { bank, periods } = useCbzData();
  const [selectedTab, setActiveTab] = useState<TabKey>(session.role === 'customer' ? 'entity' : 'snapshot');
  const [scope, setScope] = useState<EntityCode>(session.entityCode);

  // A tab shows when the role allows it and the bank has licensed that module.
  const availableTabs = useMemo(
    () => TABS.filter((t) => t.roles.includes(session.role) && (!bank || bank.modules.includes(t.key))),
    [session.role, bank],
  );
  const activeTab = availableTabs.some((t) => t.key === selectedTab) ? selectedTab : (availableTabs[0]?.key ?? selectedTab);

  const bankName = bank?.name ?? 'Loading…';
  const currentPeriod = '2026-Q3';
  const periodLocked = periods.some((p) => p.period === currentPeriod && p.status === 'locked');

  const entityLabel = (code: EntityCode) => state.entities.find((e) => e.code === code)?.name ?? code;

  function signOut() {
    sessionStore.clear();
    onSignOut();
  }

  const scopeOptions = useMemo<EntityCode[]>(() => {
    if (session.role === 'admin' || session.role === 'reader' || session.role === 'auditor') {
      return ['GROUP', ...state.entities.map((e) => e.code)];
    }
    // Everyone else is pinned to their entity — matches server-side RBAC.
    return [session.entityCode];
  }, [session.role, session.entityCode, state.entities]);

  return (
    <div className="cbz-app">
      <aside className="cbz-nav">
        <div className="cbz-nav__brand">
          <div className="cbz-nav__mark">{bankMark(bankName)}</div>
          <div>
            <div className="cbz-nav__title">{bankName}</div>
            <div className="cbz-nav__subtitle">ESG &amp; Climate Risk</div>
          </div>
        </div>
        <div className="cbz-nav__scope">
          <label>Scope</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as EntityCode)}
            disabled={scopeOptions.length === 1}
          >
            {scopeOptions.map((code) => (
              <option key={code} value={code}>
                {code === 'GROUP' ? `${bankName} (Group)` : entityLabel(code)}
              </option>
            ))}
          </select>
        </div>
        <nav>
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`cbz-nav__tab ${activeTab === tab.key ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="cbz-nav__tab-label">{tab.label}</span>
              <span className="cbz-nav__tab-desc">{tab.description}</span>
            </button>
          ))}
        </nav>
        <div className="cbz-nav__foot">
          <div className="cbz-nav__user">
            <div className="cbz-avatar">{session.fullName.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div>
            <div>
              <div className="cbz-nav__user-name">{session.fullName}</div>
              <div className="cbz-nav__user-role">
                {session.role} · {entityLabel(session.entityCode)}
              </div>
            </div>
          </div>
          {adminView ? (
            <button type="button" className="cbz-btn cbz-btn--ghost cbz-btn--block" onClick={adminView.onExit}>
              ← Back to admin console
            </button>
          ) : (
            <button type="button" className="cbz-btn cbz-btn--ghost cbz-btn--block" onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
      </aside>

      <main className="cbz-main">
        {adminView && (
          <div className="cbz-alert cbz-alert--info cbz-admin-banner">
            <span>
              You are viewing <strong>{bankName}</strong>'s dashboard as a MAvHU administrator. Changes you make here are
              recorded in the bank's audit trail under your name.
            </span>
            <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={adminView.onExit}>
              Exit
            </button>
          </div>
        )}
        {bank?.status === 'suspended' && (
          <div className="cbz-alert cbz-alert--danger">This bank's access is suspended. Contact the MAvHU team.</div>
        )}
        <header className="cbz-topbar">
          <div>
            <div className="cbz-topbar__eyebrow">
              {availableTabs.find((t) => t.key === activeTab)?.description}
            </div>
            <h1 className="cbz-topbar__title">
              {availableTabs.find((t) => t.key === activeTab)?.label}
            </h1>
          </div>
          <div className="cbz-topbar__actions">
            <span className="cbz-pill cbz-pill--frame" title={periodLocked ? 'Locked by MAvHU: no new or advanced records' : undefined}>
              {currentPeriod}
              {periodLocked ? ' · locked' : ''}
            </span>
            <span className="cbz-pill cbz-pill--frame">
              {scope === 'GROUP' ? 'Group consolidated' : entityLabel(scope)}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <div className="cbz-content" key={activeTab}>
          {activeTab === 'snapshot' && <SnapshotTab scope={scope} />}
          {activeTab === 'portfolio' && <PortfolioTab scope={scope} session={session} />}
          {activeTab === 'insurance' && <InsuranceTab scope={scope} />}
          {activeTab === 'risk' && <RiskTab scope={scope} session={session} />}
          {activeTab === 'predictive' && <PredictiveTab scope={scope} />}
          {activeTab === 'workflow' && <WorkflowTab scope={scope} session={session} />}
          {activeTab === 'entity' && <EntityTab scope={session.role === 'customer' ? session.entityCode : scope} />}
          {activeTab === 'data-entry' && <DataEntryTab session={session} scope={scope} />}
          {activeTab === 'members' && <MembersTab session={session} />}
        </div>
      </main>
    </div>
  );
}
