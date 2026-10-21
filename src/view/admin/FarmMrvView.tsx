import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { createAgriApi } from '../../model/agri/agriApi';
import type { AdminSession } from '../../model/admin/types';
import { AgriDashboard } from '../agri/AgriDashboard';

/** A farm's Agri MRV portal, opened read-only by MAvHU staff. */
export function FarmMrvView({ session }: { session: AdminSession }) {
  const navigate = useNavigate();
  const customerId = Number(useParams().customerId);
  const api = useMemo(() => createAgriApi(session.token, customerId), [session.token, customerId]);
  if (!Number.isInteger(customerId)) return <Navigate to="/admin?tab=farms" replace />;
  return <AgriDashboard api={api} onSignOut={() => navigate('/admin?tab=farms')} signOutLabel="← Back to MAvHU console" />;
}
