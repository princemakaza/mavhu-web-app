import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from '../presenter/SessionContext';
import { AdminApp } from '../view/admin/AdminApp';
import { CbzApp } from '../view/cbz/CbzApp';
import { DashboardPage, LoginPage, RoleSelectPage, SignUpPage } from './pages';

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          {/* Bank portal: every client bank's users sign in here and see only their own bank. */}
          <Route path="/" element={<CbzApp />} />
          <Route path="/cbz" element={<CbzApp />} />

          {/* MAvHU team console: onboard banks, manage users & roles, view any bank's dashboard. */}
          <Route path="/admin/*" element={<AdminApp />} />

          {/* Legacy Mavhu identity flows kept accessible for other roles. */}
          <Route path="/mavhu" element={<RoleSelectPage />} />
          <Route path="/mavhu/login/:roleKey" element={<LoginPage />} />
          <Route path="/mavhu/signup/:roleKey" element={<SignUpPage />} />
          <Route path="/mavhu/dashboard" element={<DashboardPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
