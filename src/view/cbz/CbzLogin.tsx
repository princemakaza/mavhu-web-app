import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cbzApiLogin } from '../../model/cbz/cbz_api';
import { cbzSession } from '../../model/cbz/session';
import type { CbzSession } from '../../model/cbz/types';

interface Props {
  onLogin: (session: CbzSession) => void;
}

/**
 * Sign-in for every client bank's users (CBZ, Stanbic, FBC, …). Nothing about any bank is shown
 * before sign-in; the account decides which bank's dashboard loads.
 */
export function CbzLogin({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your work email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const { member } = await cbzApiLogin(email.trim(), password);
      const session: CbzSession = {
        memberId: member.id,
        fullName: member.fullName,
        email: member.email,
        entityCode: member.entityCode,
        role: member.role,
        loginAt: new Date().toISOString(),
      };
      cbzSession.save(session);
      onLogin(session);
    } catch (err) {
      // The server explains deactivated accounts and suspended banks; anything else is bad credentials.
      const message = err instanceof Error ? err.message : '';
      setError(/deactivated|suspended/i.test(message) ? message : 'Invalid email or password.');
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
              <div className="cbz-login__mark-title">MAvHU ESG Platform</div>
              <div className="cbz-login__mark-sub">Bank ESG &amp; Climate Risk portal</div>
            </div>
          </div>
          <h1>Assurance-ready ESG for every subsidiary.</h1>
          <p>
            Group-wide dashboard for Scope 1–3, financed &amp; insurance-associated emissions, workforce and governance,
            built on PCAF-compliant calculations and a full audit trail.
          </p>
          <ul className="cbz-login__pills">
            <li>PCAF Parts A, B, C</li>
            <li>IFRS S1 / S2</li>
            <li>GRI 200/300/400</li>
            <li>RBZ · IPEC · SECZim</li>
          </ul>
          <div className="cbz-login__foot">
            Powered by <strong>MAvHU</strong>, Africa's climate MRV backbone.
          </div>
        </div>
        <form className="cbz-login__form" onSubmit={submit} noValidate>
          <div className="cbz-login__form-head">
            <h2>Sign in</h2>
            <p>Use the work email your bank's administrator registered for you.</p>
          </div>
          <label className="cbz-field">
            <span>Work email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbank.co.zw" autoComplete="username" required />
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
            MAvHU team? <Link to="/admin">Sign in to the admin console →</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
