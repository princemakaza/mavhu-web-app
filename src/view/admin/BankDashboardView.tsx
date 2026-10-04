import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { AdminSession } from '../../model/admin/types';
import { CbzDataProvider } from '../../model/cbz/CbzDataContext';
import type { CbzSession } from '../../model/cbz/types';
import { CbzDashboard } from '../cbz/CbzDashboard';

/** A bank's own dashboard, opened by a MAvHU admin with full (admin-role) access to that bank. */
export function BankDashboardView({ session }: { session: AdminSession }) {
  const navigate = useNavigate();
  const bankId = Number(useParams().bankId);
  if (!Number.isInteger(bankId)) return <Navigate to="/admin" replace />;

  const viewer: CbzSession = {
    memberId: `mavhu-admin-${session.userId}`,
    fullName: `${session.name} (MAvHU)`,
    email: session.email,
    entityCode: 'GROUP',
    role: 'admin',
    loginAt: new Date().toISOString(),
  };
  const exit = () => navigate('/admin?tab=banks');

  return (
    <CbzDataProvider key={bankId} adminView={{ token: session.token, bankId }}>
      <CbzDashboard session={viewer} onSignOut={exit} adminView={{ onExit: exit }} />
    </CbzDataProvider>
  );
}
