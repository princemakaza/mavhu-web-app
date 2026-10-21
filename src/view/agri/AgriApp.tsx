import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { agriLogin, agriSessionStore, createAgriApi, type AgriSession } from '../../model/agri/agriApi';
import { useCbzTheme } from '../../model/cbz/theme';
import { AgriDashboard } from './AgriDashboard';

/** /agri: the Agri MRV portal for agribusiness ESG users (readers, contributors, approvers). */
export function AgriApp() {
  useCbzTheme();
  const [session, setSession] = useState<AgriSession | null>(() => agriSessionStore.load());
  const signOut = () => {
    agriSessionStore.clear();
    setSession(null);
  };
  const api = useMemo(() => (session ? createAgriApi(session.token, undefined, signOut) : null), [session]);

  if (!session || !api) {
    return (
      <AgriLogin
        onLogin={(s) => {
          agriSessionStore.save(s);
          setSession(s);
        }}
      />
    );
  }
  return <AgriDashboard api={api} onSignOut={signOut} />;
}

function AgriLogin({ onLogin }: { onLogin: (s: AgriSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError(null);
    try {
      onLogin(await agriLogin(email.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cbz-login cbz-login--agri">
      <div className="cbz-login__panel">
        <div className="cbz-login__pitch">
          <div className="cbz-login__brand">
            <span className="cbz-login__mark">MRV</span>
            <div>
              <div className="cbz-login__mark-title">MAvHU Agri MRV</div>
              <div className="cbz-login__mark-sub">Measured. Verified. Sovereign.</div>
            </div>
          </div>
          <h1>Your land, measured from space and verified on the ground.</h1>
          <p>
            Monthly satellite vegetation and carbon-stock readings for every estate, farm emissions accounting with approval, and field
            verification visits. Your verified data lifts your bank's data-quality score on your loans.
          </p>
          <ul className="cbz-login__pills">
            <li>Sentinel-2 NDVI</li>
            <li>Carbon stock</li>
            <li>Field verification</li>
            <li>PCAF data quality</li>
          </ul>
          <div className="cbz-login__foot">For agribusiness ESG readers, contributors and approvers.</div>
        </div>
        <form className="cbz-login__form" onSubmit={submit} noValidate>
          <div className="cbz-login__form-head">
            <h2>Farm sign in</h2>
            <p>Use the account your farm's ESG lead set up for you.</p>
          </div>
          <label className="cbz-field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourfarm.co.zw" autoComplete="username" />
          </label>
          <label className="cbz-field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </label>
          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
          <button type="submit" className="cbz-btn cbz-btn--primary cbz-btn--block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="cbz-muted cbz-login__admin-link">
            <Link to="/">← All MAvHU portals</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
