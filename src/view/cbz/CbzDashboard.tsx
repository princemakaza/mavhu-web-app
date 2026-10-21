import { useMemo, useState, type ReactNode } from 'react';
import { useCbzData } from '../../model/cbz/CbzDataContext';
import { cbzSession as sessionStore } from '../../model/cbz/session';
import type { CbzSession, EntityCode } from '../../model/cbz/types';
import { useCbz } from '../../model/cbz/useCbz';
import { ThemeToggle } from './components/ThemeToggle';
import { DataEntryTab } from './tabs/DataEntryTab';
import { DisclosuresTab } from './tabs/DisclosuresTab';
import { EntityTab } from './tabs/EntityTab';
import { EvidenceTab } from './tabs/EvidenceTab';
import { DataOwnershipTab, MaterialityTab, StakeholdersTab, SuppliersTab } from './tabs/GovernanceTabs';
import { EnvironmentTab, SocialTab } from './tabs/ImpactTabs';
import { InsightsTab } from './tabs/InsightsTab';
import { InsuranceTab } from './tabs/InsuranceTab';
import { MembersTab } from './tabs/MembersTab';
import { AppetiteTab, DecarbonisationTab, TargetsTab } from './tabs/PerformanceTabs';
import { PortfolioTab } from './tabs/PortfolioTab';
import { RiskTab } from './tabs/RiskTab';
import { ScenariosTab } from './tabs/ScenariosTab';
import { SnapshotTab } from './tabs/SnapshotTab';
import { SustainableFinanceTab } from './tabs/SustainableFinanceTab';
import { WorkflowTab } from './tabs/WorkflowTab';

type Role = CbzSession['role'] | 'mavhu-admin' | 'platform-auditor';

interface TabDef {
  key: string;
  label: string;
  description: string;
  group: string;
  /** Bank licence key (banks.modules) that switches the view on. */
  module: string;
  /** Roles that see the view; undefined = every role except customer. */
  roles?: Role[];
  render: (p: { scope: EntityCode; session: CbzSession }) => ReactNode;
}

const STAFF: Role[] = ['admin', 'approver', 'contributor', 'reader', 'auditor', 'mavhu-admin', 'platform-auditor'];

const TABS: TabDef[] = [
  { key: 'snapshot', group: 'Overview', label: 'Group snapshot', description: 'Consolidated ESG picture', module: 'snapshot', render: ({ scope }) => <SnapshotTab scope={scope} /> },
  { key: 'entity', group: 'Overview', label: 'My entity', description: 'One subsidiary in detail', module: 'entity', roles: [...STAFF, 'customer'], render: ({ scope, session }) => <EntityTab scope={session.role === 'customer' ? session.entityCode : scope} /> },

  { key: 'portfolio', group: 'Finance & emissions', label: 'Financed emissions', description: 'PCAF Part A · MRV-verified borrowers', module: 'portfolio', render: ({ scope, session }) => <PortfolioTab scope={scope} session={session} /> },
  { key: 'insurance', group: 'Finance & emissions', label: 'Insurance emissions', description: 'PCAF Part C', module: 'insurance', render: ({ scope }) => <InsuranceTab scope={scope} /> },
  { key: 'sustainable', group: 'Finance & emissions', label: 'Sustainable finance', description: 'Taxonomy tags · ESG-linked products', module: 'sustainable-finance', render: ({ scope }) => <SustainableFinanceTab scope={scope} /> },

  { key: 'risk', group: 'Climate risk', label: 'Risks & incidents', description: 'Register · heat map · incidents', module: 'risk', render: ({ scope }) => <RiskTab scope={scope} /> },
  { key: 'scenarios', group: 'Climate risk', label: 'Scenarios & Climate VaR', description: 'NGFS stress test · exposure', module: 'scenarios', render: ({ scope }) => <ScenariosTab scope={scope} /> },
  { key: 'appetite', group: 'Climate risk', label: 'Risk appetite', description: 'Limits · escalations', module: 'appetite', render: () => <AppetiteTab /> },

  { key: 'targets', group: 'Performance', label: 'Targets & KPIs', description: 'Progress · variation', module: 'targets', render: ({ scope }) => <TargetsTab scope={scope} /> },
  { key: 'decarbonisation', group: 'Performance', label: 'Decarbonisation', description: 'Programmes · milestones', module: 'decarbonisation', render: ({ scope }) => <DecarbonisationTab scope={scope} /> },
  { key: 'environment', group: 'Performance', label: 'Environment', description: 'Energy · water · waste', module: 'environment', render: ({ scope }) => <EnvironmentTab scope={scope} /> },
  { key: 'social', group: 'Performance', label: 'Social impact', description: 'Inclusion · community', module: 'social', render: ({ scope }) => <SocialTab scope={scope} /> },

  { key: 'materiality', group: 'Governance', label: 'Materiality', description: 'Double materiality matrix', module: 'materiality', render: () => <MaterialityTab /> },
  { key: 'stakeholders', group: 'Governance', label: 'Stakeholders', description: 'Register · engagement log', module: 'stakeholders', render: () => <StakeholdersTab /> },
  { key: 'suppliers', group: 'Governance', label: 'Suppliers', description: 'Value-chain ESG risk', module: 'suppliers', render: () => <SuppliersTab /> },
  { key: 'owners', group: 'Governance', label: 'Data ownership', description: 'Owner per dataset', module: 'data-ownership', render: ({ scope }) => <DataOwnershipTab scope={scope} /> },

  { key: 'disclosures', group: 'Reporting & assurance', label: 'Disclosures', description: 'IFRS S2 · GRI · TCFD · local', module: 'disclosures', render: ({ scope }) => <DisclosuresTab scope={scope} /> },
  { key: 'evidence', group: 'Reporting & assurance', label: 'Evidence', description: 'Source documents', module: 'evidence', render: ({ scope }) => <EvidenceTab scope={scope} /> },
  { key: 'workflow', group: 'Reporting & assurance', label: 'Workflow & audit', description: 'Approve · lock · audit trail', module: 'workflow', render: ({ scope }) => <WorkflowTab scope={scope} /> },
  { key: 'insights', group: 'Reporting & assurance', label: 'Insights', description: 'Forecast · anomalies', module: 'predictive', render: ({ scope }) => <InsightsTab scope={scope} /> },

  { key: 'data-entry', group: 'Data', label: 'Data entry', description: 'Form · Excel / CSV import', module: 'data-entry', roles: ['admin', 'approver', 'contributor', 'customer', 'mavhu-admin'], render: ({ scope, session }) => <DataEntryTab session={session} scope={scope} /> },
  { key: 'members', group: 'Data', label: 'Members', description: 'Staff & customers', module: 'members', roles: ['admin', 'approver', 'mavhu-admin', 'platform-auditor'], render: ({ session }) => <MembersTab session={session} /> },
];

const GROUPS = [...new Set(TABS.map((t) => t.group))];

interface Props {
  session: CbzSession;
  onSignOut: () => void;
  /** Set when MAvHU staff open this bank's dashboard from the admin console. */
  adminView?: { onExit: () => void; readOnly?: boolean };
}

/** "CBZ Holdings" → "CBZ", "Stanbic Bank Zimbabwe" → "STA". */
function bankMark(name: string): string {
  const first = name.split(/\s+/)[0] ?? '';
  return (first.length <= 4 ? first : first.slice(0, 3)).toUpperCase();
}

const CAPABILITY_LABEL: Record<string, string> = {
  'submit-data': 'Submit data',
  'write-data': 'Edit records',
  approve: 'Approve & lock',
  'manage-members': 'Manage members',
  'manage-registers': 'Manage registers',
  'operational-registers': 'Log activity',
  'tag-taxonomy': 'Tag taxonomy',
  publish: 'Publish disclosures',
};

export function CbzDashboard({ session, onSignOut, adminView }: Props) {
  const state = useCbz();
  const { bank, periods, me, loading, error } = useCbzData();
  const role = (me?.role ?? session.role) as Role;
  const [selectedTab, setActiveTab] = useState<string>(session.role === 'customer' ? 'entity' : 'snapshot');
  const [scope, setScope] = useState<EntityCode>(session.entityCode);

  const availableTabs = useMemo(
    () => TABS.filter((t) => (t.roles ?? STAFF).includes(role) && (!bank || bank.modules.includes(t.module))),
    [role, bank],
  );
  const active = availableTabs.find((t) => t.key === selectedTab) ?? availableTabs[0];

  const bankName = bank?.name ?? 'Loading…';
  const currentPeriod = '2026-Q3';
  const periodLocked = periods.some((p) => p.period === currentPeriod && p.status === 'locked');
  const entityLabel = (code: EntityCode) => state.entities.find((e) => e.code === code)?.name ?? code;

  const scopeOptions = useMemo<EntityCode[]>(() => {
    if (['admin', 'reader', 'auditor', 'approver', 'mavhu-admin', 'platform-auditor'].includes(role)) {
      return ['GROUP', ...state.entities.map((e) => e.code)];
    }
    // Contributors and customers are pinned to their entity, as the server enforces.
    return [session.entityCode];
  }, [role, session.entityCode, state.entities]);

  function signOut() {
    sessionStore.clear();
    onSignOut();
  }

  return (
    <div className="cbz-app">
      <aside className="cbz-nav">
        <div className="cbz-nav__brand">
          <div className="cbz-nav__mark">{bankMark(bankName)}</div>
          <div>
            <div className="cbz-nav__title">{bankName}</div>
            <div className="cbz-nav__subtitle">ESG &amp; Climate Risk · MAvHU</div>
          </div>
        </div>
        <div className="cbz-nav__scope">
          <label htmlFor="cbz-scope">Scope</label>
          <select id="cbz-scope" value={scope} onChange={(e) => setScope(e.target.value)} disabled={scopeOptions.length === 1}>
            {scopeOptions.map((code) => (
              <option key={code} value={code}>
                {code === 'GROUP' ? `${bankName} (Group)` : entityLabel(code)}
              </option>
            ))}
          </select>
        </div>
        <nav aria-label="Dashboard sections">
          {GROUPS.map((group) => {
            const tabs = availableTabs.filter((t) => t.group === group);
            if (!tabs.length) return null;
            return (
              <div key={group} className="cbz-nav__group">
                <div className="cbz-nav__group-label">{group}</div>
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`cbz-nav__tab ${active?.key === tab.key ? 'is-active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                    title={tab.description}
                  >
                    <span className="cbz-nav__tab-label">{tab.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="cbz-nav__foot">
          <div className="cbz-nav__user">
            <div className="cbz-avatar">{session.fullName.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div>
            <div>
              <div className="cbz-nav__user-name">{session.fullName}</div>
              <div className="cbz-nav__user-role">
                {me?.roleLabel ?? session.role} · {session.entityCode === 'GROUP' ? 'Group' : entityLabel(session.entityCode)}
              </div>
            </div>
          </div>
          {me && (
            <details className="cbz-role-card">
              <summary>What my role can do</summary>
              {me.capabilities.length ? (
                <ul>
                  {me.capabilities.map((c) => (
                    <li key={c}>✓ {CAPABILITY_LABEL[c] ?? c}</li>
                  ))}
                </ul>
              ) : (
                <p>Read-only: view every dashboard, the audit trail and evidence.</p>
              )}
            </details>
          )}
          {adminView ? (
            <button type="button" className="cbz-btn cbz-btn--ghost cbz-btn--block" onClick={adminView.onExit}>
              ← Back to MAvHU console
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
              You are viewing <strong>{bankName}</strong> as {adminView.readOnly ? 'a MAvHU auditor (read-only)' : 'a MAvHU administrator'}.
              {adminView.readOnly ? '' : ' Changes are recorded in the bank’s audit trail under your name.'}
            </span>
            <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={adminView.onExit}>
              Exit
            </button>
          </div>
        )}
        {bank?.status === 'suspended' && <div className="cbz-alert cbz-alert--danger">This bank's access is suspended. Contact the MAvHU team.</div>}
        {error && <div className="cbz-alert cbz-alert--danger">Could not load data: {error}</div>}
        <header className="cbz-topbar">
          <div>
            <div className="cbz-topbar__eyebrow">
              {active?.group} · {active?.description}
            </div>
            <h1 className="cbz-topbar__title">{active?.label}</h1>
          </div>
          <div className="cbz-topbar__actions">
            {loading && <span className="cbz-pill cbz-pill--frame">Refreshing…</span>}
            <span className="cbz-pill cbz-pill--frame" title={periodLocked ? 'Locked by MAvHU: no new or changed records' : undefined}>
              {currentPeriod}
              {periodLocked ? ' · locked' : ''}
            </span>
            <span className="cbz-pill cbz-pill--frame">{scope === 'GROUP' ? 'Group consolidated' : entityLabel(scope)}</span>
            <ThemeToggle />
          </div>
        </header>

        <div className="cbz-content" key={`${active?.key}-${scope}`}>
          {active ? active.render({ scope, session }) : <p className="cbz-muted">No modules are licensed for your role.</p>}
        </div>
      </main>
    </div>
  );
}
