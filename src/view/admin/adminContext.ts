import { createContext, useContext } from 'react';
import type { AdminSession } from '../../model/admin/types';

/** The signed-in MAvHU staff member; readOnly hides every control that would change data. */
export const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession(): AdminSession {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error('useAdminSession must be used inside the admin console');
  return session;
}

export const useReadOnly = () => Boolean(useAdminSession().readOnly);
