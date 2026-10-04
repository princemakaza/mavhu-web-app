import { useSearchParams } from 'react-router-dom';
import type { AdminSession } from '../../model/admin/types';
import { ThemeToggle } from '../cbz/components/ThemeToggle';
import { AuditTab } from './tabs/AuditTab';
import { BanksTab } from './tabs/BanksTab';
import { OverviewTab } from './tabs/OverviewTab';
import { PeriodsTab } from './tabs/PeriodsTab';
import { RfpCoverageTab } from './tabs/RfpCoverageTab';
import { TeamTab } from './tabs/TeamTab';
import { UsersTab } from './tabs/UsersTab';

const TABS = [
  { key: 'overview', label: 'Platform overview', description: 'Every client bank at a glance' },
  { key: 'banks', label: 'Banks', description: 'Onboard banks, subsidiaries & modules' },
  { key: 'users', label: 'Bank users & roles', description: 'Create users, assign roles' },
  { key: 'team', label: 'MAvHU team', description: 'Platform admins & auditors' },
  { key: 'periods', label: 'Reporting periods', description: 'Lock periods for assurance' },
  { key: 'audit', label: 'Audit trail', description: 'Cross-bank change log & export' },
  { key: 'rfp', label: 'RFP coverage', description: 'Mandatory demo items vs build' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AdminConsole({ session, onSignOut }: { session: AdminSession; onSignOut: () => void }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active: TabKey = TABS.some((t) => t.key === requested) ? (requested as TabKey) : 'overview';
  const tab = TABS.find((t) => t.key === active)!;
  const go = (key: TabKey) => setParams({ tab: key });

  return (
    <div className="cbz-app">
      <aside className="cbz-nav">
        <div className="cbz-nav__brand">
          <div className="cbz-nav__mark cbz-nav__mark--mavhu">MAvHU</div>
          <div>
            <div className="cbz-nav__title">MAvHU Africa</div>
            <div className="cbz-nav__subtitle">Platform administration</div>
          </div>
        </div>
        <nav>
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`cbz-nav__tab ${active === t.key ? 'is-active' : ''}`} onClick={() => go(t.key)}>
              <span className="cbz-nav__tab-label">{t.label}</span>
              <span className="cbz-nav__tab-desc">{t.description}</span>
            </button>
          ))}
        </nav>
        <div className="cbz-nav__foot">
          <div className="cbz-nav__user">
            <div className="cbz-avatar">{session.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div>
            <div>
              <div className="cbz-nav__user-name">{session.name}</div>
              <div className="cbz-nav__user-role">MAvHU admin · {session.email}</div>
            </div>
          </div>
          <button type="button" className="cbz-btn cbz-btn--ghost cbz-btn--block" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="cbz-main">
        <header className="cbz-topbar">
          <div>
            <div className="cbz-topbar__eyebrow">{tab.description}</div>
            <h1 className="cbz-topbar__title">{tab.label}</h1>
          </div>
          <div className="cbz-topbar__actions">
            <span className="cbz-pill cbz-pill--frame">Synthetic demo data</span>
            <ThemeToggle />
          </div>
        </header>

        <div className="cbz-content" key={active}>
          {active === 'overview' && <OverviewTab onOpenTab={go} />}
          {active === 'banks' && <BanksTab />}
          {active === 'users' && <UsersTab />}
          {active === 'team' && <TeamTab session={session} />}
          {active === 'periods' && <PeriodsTab />}
          {active === 'audit' && <AuditTab />}
          {active === 'rfp' && <RfpCoverageTab />}
        </div>
      </main>
    </div>
  );
}
