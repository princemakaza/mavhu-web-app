import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminApp } from '../view/admin/AdminApp';
import { AgriApp } from '../view/agri/AgriApp';
import { CbzApp } from '../view/cbz/CbzApp';
import { PortalLanding } from '../view/portal/PortalLanding';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Choose a portal: every role signs in to the one built for it. */}
        <Route path="/" element={<PortalLanding />} />

        {/* Bank portal: each client bank's users see only their own bank. */}
        <Route path="/bank" element={<CbzApp />} />
        <Route path="/cbz" element={<Navigate to="/bank" replace />} />

        {/* Agri MRV portal: agribusiness ESG readers, contributors and approvers. */}
        <Route path="/agri/*" element={<AgriApp />} />
        <Route path="/mavhu/*" element={<Navigate to="/agri" replace />} />

        {/* MAvHU console: administrators (full) and MAvHU auditors (read-only). */}
        <Route path="/admin/*" element={<AdminApp />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
