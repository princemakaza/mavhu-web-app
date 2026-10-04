import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../model/admin/adminApi';
import type { AdminSession } from '../../model/admin/types';

export function AdminLogin({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onLogin(await adminApi.login(email.trim(), password));
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(/invalid email or password/i.test(message) ? 'Incorrect email or password.' : message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cbz-login">
      <div className="cbz-login__panel">
        <div className="cbz-login__pitch">
          <div className="cbz-login__brand">
            <span className="cbz-login__mark">MAvHU</span>
            <div>
              <div className="cbz-login__mark-title">MAvHU Africa</div>
              <div className="cbz-login__mark-sub">Platform administration</div>
            </div>
          </div>
          <h1>Every client bank, one console.</h1>
          <p>
            Onboard banks and their subsidiaries, license dashboard modules, assign roles to bank users, lock reporting
            periods for assurance and review every bank's audit trail.
          </p>
          <ul className="cbz-login__pills">
            <li>Multi-bank onboarding</li>
            <li>Role-based access</li>
            <li>Period locking</li>
            <li>Cross-bank audit</li>
          </ul>
          <div className="cbz-login__foot">For MAvHU staff only. Bank users sign in on the bank portal.</div>
        </div>
        <form className="cbz-login__form" onSubmit={submit} noValidate>
          <div className="cbz-login__form-head">
            <h2>Admin sign in</h2>
            <p>Use your @mavhu.africa account.</p>
          </div>
          <label className="cbz-field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mavhu.africa" autoComplete="username" required />
          </label>
          <label className="cbz-field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
          </label>
          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
          <button type="submit" className="cbz-btn cbz-btn--primary cbz-btn--block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="cbz-muted cbz-login__admin-link">
            Bank user? <Link to="/">Go to the bank portal →</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
