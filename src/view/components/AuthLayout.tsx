import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { CheckIcon } from './Icons';
import { ThemeToggle } from './ThemeToggle';

const HIGHLIGHTS = [
  'Satellite-verified carbon stock for every estate',
  'Scope 1, 2 and 3 emissions accounting',
  'ESG data banks can rely on',
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth__panel">
        <Brand size={44} />
        <div className="auth__pitch">
          <h1>Climate intelligence for African agribusiness.</h1>
          <p>Measure, verify and report the carbon story of your land, in one trusted platform.</p>
          <ul>
            {HIGHLIGHTS.map((item) => (
              <li key={item}>
                <CheckIcon />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <small>&copy; {new Date().getFullYear()} Mavhu Africa</small>
      </aside>

      <main className="auth__main">
        <div className="auth__topbar">
          <span className="auth__mobile-brand">
            <Brand size={34} />
          </span>
          <ThemeToggle />
        </div>
        <div className="auth__content">{children}</div>
      </main>
    </div>
  );
}
