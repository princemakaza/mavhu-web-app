import { useEffect, useState } from 'react';
import { cbzSession as sessionStore } from '../../model/cbz/session';
import { useCbzTheme } from '../../model/cbz/theme';
import type { CbzSession } from '../../model/cbz/types';
import { CbzDashboard } from './CbzDashboard';
import { CbzLogin } from './CbzLogin';

// Top-level flip between login and dashboard. Calling useCbzTheme up here
// makes sure the <html data-cbz-theme=""> attribute is set the moment either
// screen renders, so the login inherits the same palette as the app.
export function CbzApp() {
  const [session, setSession] = useState<CbzSession | null>(null);
  const [ready, setReady] = useState(false);
  useCbzTheme();

  useEffect(() => {
    setSession(sessionStore.load());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!session) {
    return <CbzLogin onLogin={setSession} />;
  }
  return <CbzDashboard session={session} onSignOut={() => setSession(null)} />;
}
