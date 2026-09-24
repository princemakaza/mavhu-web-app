import type { DashboardViewModel } from '../../presenter/useDashboardPresenter';
import { Brand } from '../components/Brand';
import { CheckIcon, LogOutIcon, RoleIcon } from '../components/Icons';
import { ThemeToggle } from '../components/ThemeToggle';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function DashboardScreen({ user, organizationName, activeRole, heldRoles, signOut }: DashboardViewModel) {
  return (
    <div className="select">
      <header className="select__header">
        <Brand />
        <div className="header-actions">
          <ThemeToggle />
          <button type="button" className="button button--ghost" onClick={signOut}>
            <LogOutIcon /> Sign out
          </button>
        </div>
      </header>

      <main className="select__main dashboard">
        <section className="welcome">
          <span className="avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <div>
            <p className="eyebrow">Signed in as {activeRole.label}</p>
            <h1 className="dashboard__title">Welcome, {user.name.split(' ')[0]}</h1>
            <p className="select__lead">
              {organizationName ? `${organizationName} · ` : ''}
              {user.email}
            </p>
          </div>
        </section>

        <div className="dashboard__grid">
          <section className="panel">
            <h2>
              <span className="role-tag__icon">
                <RoleIcon role={activeRole.key} />
              </span>
              What you can do
            </h2>
            <ul className="checklist">
              {activeRole.capabilities.map((capability) => (
                <li key={capability}>
                  <CheckIcon /> {capability}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Your roles</h2>
            <div className="chip-row">
              {heldRoles.map((role) => (
                <span key={role.key} className="chip">
                  {role.label}
                </span>
              ))}
            </div>
            <p className="panel__note">
              Your workspace is being built. The tools for your role will appear here as they are released.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
