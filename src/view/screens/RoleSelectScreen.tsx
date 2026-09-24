import type { RoleSelectViewModel } from '../../presenter/useRoleSelectPresenter';
import { Brand } from '../components/Brand';
import { ArrowRightIcon, LockIcon, RoleIcon } from '../components/Icons';
import { ThemeToggle } from '../components/ThemeToggle';

export function RoleSelectScreen({ roles, selectRole }: RoleSelectViewModel) {
  return (
    <div className="select">
      <header className="select__header">
        <Brand />
        <ThemeToggle />
      </header>

      <main className="select__main">
        <p className="eyebrow">Welcome to Mavhu</p>
        <h1 className="select__title">Choose how you&rsquo;ll sign in</h1>
        <p className="select__lead">
          Select the role assigned to you. You&rsquo;ll be taken to the sign-in for that role.
        </p>

        <ul className="role-grid">
          {roles.map((role) => (
            <li key={role.key}>
              <button type="button" className="role-card" onClick={() => selectRole(role)}>
                <span className="role-card__icon">
                  <RoleIcon role={role.key} />
                </span>
                <span className="role-card__label">{role.label}</span>
                <span className="role-card__summary">{role.summary}</span>
                <span className="role-card__footer">
                  {role.selfSignUp ? (
                    <span className="chip">Sign in &middot; Sign up</span>
                  ) : (
                    <span className="chip chip--muted">
                      <LockIcon /> Provisioned by Mavhu
                    </span>
                  )}
                  <span className="role-card__go">
                    <ArrowRightIcon />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className="select__note">
          New to Mavhu? Choose ESG Approver, Contributor or Reader to create an account. Admin and Auditor accounts are
          created for you by Mavhu Africa.
        </p>
      </main>
    </div>
  );
}
