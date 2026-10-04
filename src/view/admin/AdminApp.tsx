import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { setAdminUnauthorizedHandler } from '../../model/admin/adminApi';
import { adminSessionStore } from '../../model/admin/adminSession';
import type { AdminSession } from '../../model/admin/types';
import { useCbzTheme } from '../../model/cbz/theme';
import { AdminConsole } from './AdminConsole';
import { AdminLogin } from './AdminLogin';
import { BankDashboardView } from './BankDashboardView';

/** The MAvHU team's console, mounted at /admin. */
export function AdminApp() {
  useCbzTheme();
  const [session, setSession] = useState<AdminSession | null>(() => adminSessionStore.load());

  useEffect(() => {
    setAdminUnauthorizedHandler(() => {
      adminSessionStore.clear();
      setSession(null);
    });
    return () => setAdminUnauthorizedHandler(null);
  }, []);

  if (!session) {
    return (
      <AdminLogin
        onLogin={(next) => {
          adminSessionStore.save(next);
          setSession(next);
        }}
      />
    );
  }

  const signOut = () => {
    adminSessionStore.clear();
    setSession(null);
  };

  return (
    <Routes>
      <Route index element={<AdminConsole session={session} onSignOut={signOut} />} />
      <Route path="banks/:bankId/dashboard" element={<BankDashboardView session={session} />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
