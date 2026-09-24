import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { organizationService } from '../model/api/organizationService';
import type { RoleKey } from '../model/roles';
import { sessionStorageModel } from '../model/sessionStorage';
import type { AuthResponse, Session } from '../model/types';

interface SessionContextValue {
  session: Session | null;
  startSession: (auth: AuthResponse, activeRole: RoleKey) => Promise<void>;
  endSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => sessionStorageModel.load());

  const startSession = useCallback(async (auth: AuthResponse, activeRole: RoleKey) => {
    const organizationName = await organizationService.getName(auth.user.customerId);
    const next: Session = { token: auth.accessToken, user: auth.user, activeRole, organizationName };
    sessionStorageModel.save(next);
    setSession(next);
  }, []);

  const endSession = useCallback(() => {
    sessionStorageModel.clear();
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, startSession, endSession }), [session, startSession, endSession]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
