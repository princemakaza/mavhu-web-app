import { useNavigate } from 'react-router-dom';
import { ROLES, type RoleDefinition } from '../model/roles';

export function useRoleSelectPresenter() {
  const navigate = useNavigate();

  return {
    roles: ROLES,
    selectRole: (role: RoleDefinition) => navigate(`/login/${role.key}`),
  };
}

export type RoleSelectViewModel = ReturnType<typeof useRoleSelectPresenter>;
