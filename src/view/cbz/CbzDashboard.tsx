import { useMemo, useState } from 'react';
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

const TABS: TabDef[] = [
  { key: 'snapshot', label: 'Group snapshot', description: 'Consolidated Group ESG picture', roles: ['admin', 'approver', 'reader'] },
  { key: 'portfolio', label: 'Financed emissions', description: 'PCAF Part A · all asset classes', roles: ['admin', 'approver', 'contributor', 'reader'] },
  { key: 'insurance', label: 'Insurance emissions', description: 'PCAF Part C · insurance-associated', roles: ['admin', 'approver', 'contributor', 'reader'] },
  { key: 'risk', label: 'Risk heatmap', description: 'Physical, transition & opportunity', roles: ['admin', 'approver', 'contributor', 'reader'] },
  { key: 'predictive', label: 'Predictive', description: 'Forecast + anomaly (simplified)', roles: ['admin', 'approver', 'reader'] },
  { key: 'workflow', label: 'Workflow', description: 'Draft → review → approved → locked', roles: ['admin', 'approver', 'contributor'] },
  { key: 'entity', label: 'My entity', description: 'Your subsidiary in detail', roles: ['admin', 'approver', 'contributor', 'reader', 'customer'] },
  { key: 'data-entry', label: 'Data entry', description: 'Upload file or manual form', roles: ['admin', 'approver', 'contributor', 'customer'] },
  { key: 'members', label: 'Members & customers', description: 'Onboard staff and clients', roles: ['admin', 'approver'] },
];

interface Props {
  session: CbzSession;
  onSignOut: () => void;
}

export function CbzDashboard({ session, onSignOut }: Props) {
  const state = useCbz();
  const [activeTab, setActiveTab] = useState<TabKey>(session.role === 'customer' ? 'entity' : 'snapshot');
  const [scope, setScope] = useState<EntityCode>(session.entityCode);

  const availableTabs = useMemo(() => TABS.filter((t) => t.roles.includes(session.role)), [session.role]);

  const entityLabel = (code: EntityCode) => state.entities.find((e) => e.code === code)?.name ?? code;

  function signOut() {
    sessionStore.clear();
    onSignOut();
  }

  const scopeOptions = useMemo<EntityCode[]>(() => {
    if (session.role === 'admin' || session.role === 'reader') {
      return ['GROUP', ...state.entities.map((e) => e.code)];
    }
    // Everyone else is pinned to their entity — matches server-side RBAC.
    return [session.entityCode];
  }, [session.role, session.entityCode, state.entities]);

  return (
    <div className="cbz-app">
      <aside className="cbz-nav">
        <div className="cbz-nav__brand">
          <div className="cbz-nav__mark">CBZ</div>
          <div>
            <div className="cbz-nav__title">CBZ Holdings</div>
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
                {code === 'GROUP' ? 'CBZ Holdings (Group)' : entityLabel(code)}
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
          <button type="button" className="cbz-btn cbz-btn--ghost cbz-btn--block" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="cbz-main">
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
            <span className="cbz-pill cbz-pill--frame">2026-Q3</span>
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
