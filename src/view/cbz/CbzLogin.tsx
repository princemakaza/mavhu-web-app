import { useMemo, useState } from 'react';
import { cbzApiLogin } from '../../model/cbz/cbz_api';
import { useCbzData } from '../../model/cbz/CbzDataContext';
import { cbzSession } from '../../model/cbz/session';
import type { CbzSession, Member } from '../../model/cbz/types';

interface Props {
  onLogin: (session: CbzSession) => void;
}

export function CbzLogin({ onLogin }: Props) {
  const { state } = useCbzData();
  const [email, setEmail] = useState('anesu.mutasa@cbzholdings.co.zw');
  const [password, setPassword] = useState('cbz-demo');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showList, setShowList] = useState(false);

  const membersByEntity = useMemo(() => {
    const groups = new Map<string, Member[]>();
    for (const m of state.members) {
      const key = m.entityCode;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return groups;
  }, [state.members]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { member, token: _ } = await cbzApiLogin(email.trim(), password);
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
    } catch {
      setError('Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  function pick(member: Member) {
    setEmail(member.email);
    setPassword('cbz-demo');
    setShowList(false);
  }

  const entityLabel = (code: string) => state.entities.find((e) => e.code === code)?.name ?? code;

  return (
    <div className="cbz-login">
      <div className="cbz-login__panel">
        <div className="cbz-login__pitch">
          <div className="cbz-login__brand">
            <span className="cbz-login__mark">CBZ</span>
            <div>
              <div className="cbz-login__mark-title">CBZ Holdings</div>
              <div className="cbz-login__mark-sub">ESG &amp; Climate Risk Platform</div>
            </div>
          </div>
          <h1>Assurance-ready ESG for every subsidiary.</h1>
          <p>
            Group-wide dashboard for Scope 1–3, financed &amp; insurance-associated emissions, workforce and
            governance — assembled from the same PCAF-compliant primitives that power the audit trail.
          </p>
          <ul className="cbz-login__pills">
            <li>PCAF Parts A, B, C</li>
            <li>IFRS S1 / S2</li>
            <li>GRI 200/300/400</li>
            <li>RBZ · IPEC · SECZim</li>
          </ul>
          <div className="cbz-login__foot">
            Powered by <strong>MAvHU</strong> — Africa's climate MRV backbone.
          </div>
        </div>
        <form className="cbz-login__form" onSubmit={submit} noValidate>
          <div className="cbz-login__form-head">
            <h2>Sign in</h2>
            <p>Use your CBZ Holdings email and password.</p>
          </div>
          <label className="cbz-field">
            <span>Work email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@cbz.co.zw"
              autoComplete="username"
              required
            />
          </label>
          <label className="cbz-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
          <button type="submit" className="cbz-btn cbz-btn--primary cbz-btn--block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="cbz-btn cbz-btn--ghost cbz-btn--block"
            onClick={() => setShowList((v) => !v)}
          >
            {showList ? 'Hide' : 'Pick a demo account'}
          </button>
          {showList && (
            <div className="cbz-login__picker">
              {[...membersByEntity.entries()].map(([entityCode, members]) => (
                <div key={entityCode} className="cbz-login__picker-group">
                  <div className="cbz-login__picker-title">{entityLabel(entityCode)}</div>
                  <ul>
                    {members.map((m) => (
                      <li key={m.id}>
                        <button type="button" onClick={() => pick(m)}>
                          <div>
                            <strong>{m.fullName}</strong>
                            <span className="cbz-chip cbz-chip--sm cbz-chip--role">{m.role}</span>
                          </div>
                          <span className="cbz-muted">{m.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
