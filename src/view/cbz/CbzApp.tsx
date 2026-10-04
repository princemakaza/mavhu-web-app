import { useEffect, useState } from 'react';
import { cbzApiLogout, setCbzUnauthorizedHandler } from '../../model/cbz/cbz_api';
import { CbzDataProvider, useCbzData } from '../../model/cbz/CbzDataContext';
import { cbzSession as sessionStore } from '../../model/cbz/session';
import { useCbzTheme } from '../../model/cbz/theme';
import type { CbzSession } from '../../model/cbz/types';
import { CbzDashboard } from './CbzDashboard';
import { CbzLogin } from './CbzLogin';

function CbzAppInner() {
  const [session, setSession] = useState<CbzSession | null>(null);
  const [ready, setReady] = useState(false);
  const { refresh } = useCbzData();
  useCbzTheme();

  useEffect(() => {
    setSession(sessionStore.load());
    setReady(true);
  }, []);

  // An expired token, deactivated account or suspended bank ends the session.
  useEffect(() => {
    setCbzUnauthorizedHandler(() => {
      cbzApiLogout();
      sessionStore.clear();
      setSession(null);
      void refresh();
    });
    return () => setCbzUnauthorizedHandler(null);
  }, [refresh]);

  if (!ready) return null;

  function handleSignOut() {
    cbzApiLogout();
    sessionStore.clear();
    setSession(null);
    void refresh();
  }

  // Data loaded before sign-in is the anonymous (default bank) view; reload it under the member's own bank.
  function handleLogin(next: CbzSession) {
    setSession(next);
    void refresh();
  }

  if (!session) {
    return <CbzLogin onLogin={handleLogin} />;
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
