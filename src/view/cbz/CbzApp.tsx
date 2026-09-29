import { useEffect, useState } from 'react';
import { cbzApiLogout } from '../../model/cbz/cbz_api';
import { CbzDataProvider } from '../../model/cbz/CbzDataContext';
import { cbzSession as sessionStore } from '../../model/cbz/session';
import { useCbzTheme } from '../../model/cbz/theme';
import type { CbzSession } from '../../model/cbz/types';
import { CbzDashboard } from './CbzDashboard';
import { CbzLogin } from './CbzLogin';

function CbzAppInner() {
  const [session, setSession] = useState<CbzSession | null>(null);
  const [ready, setReady] = useState(false);
  useCbzTheme();

  useEffect(() => {
    setSession(sessionStore.load());
    setReady(true);
  }, []);

  if (!ready) return null;

  function handleSignOut() {
    cbzApiLogout();
    sessionStore.clear();
    setSession(null);
  }

  if (!session) {
    return <CbzLogin onLogin={setSession} />;
  }
  return <CbzDashboard session={session} onSignOut={handleSignOut} />;
}

export function CbzApp() {
  return (
    <CbzDataProvider>
      <CbzAppInner />
    </CbzDataProvider>
  );
}
