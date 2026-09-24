import { useNavigate } from 'react-router-dom';
import { findRole, findRoleByApiName, type RoleDefinition } from '../model/roles';
import type { Session } from '../model/types';
import { useSession } from './SessionContext';

export function useDashboardPresenter(session: Session) {
  const navigate = useNavigate();
  const { endSession } = useSession();

  const activeRole = findRole(session.activeRole) as RoleDefinition;
  const heldRoles = session.user.roles
    .map(findRoleByApiName)
    .filter((role): role is RoleDefinition => Boolean(role));

  return {
    user: session.user,
    organizationName: session.organizationName,
    activeRole,
    heldRoles,
    signOut: () => {
      endSession();
      navigate('/', { replace: true });
    },
  };
}

export type DashboardViewModel = ReturnType<typeof useDashboardPresenter>;
