import { Navigate, useParams } from 'react-router-dom';
import { findRole } from '../model/roles';
import { useSession } from '../presenter/SessionContext';
import { useDashboardPresenter } from '../presenter/useDashboardPresenter';
import { useLoginPresenter } from '../presenter/useLoginPresenter';
import { useRoleSelectPresenter } from '../presenter/useRoleSelectPresenter';
import { useSignUpPresenter } from '../presenter/useSignUpPresenter';
import { DashboardScreen } from '../view/screens/DashboardScreen';
import { LoginScreen } from '../view/screens/LoginScreen';
import { RoleSelectScreen } from '../view/screens/RoleSelectScreen';
import { SignUpScreen } from '../view/screens/SignUpScreen';
import type { RoleDefinition } from '../model/roles';
import type { Session } from '../model/types';

/** Each page binds one presenter to one dumb view. */

export function RoleSelectPage() {
  const { session } = useSession();
  const presenter = useRoleSelectPresenter();
  if (session) return <Navigate to="/dashboard" replace />;
  return <RoleSelectScreen {...presenter} />;
}

function LoginForRole({ role }: { role: RoleDefinition }) {
  return <LoginScreen {...useLoginPresenter(role)} />;
}

export function LoginPage() {
  const { session } = useSession();
  const role = findRole(useParams().roleKey);
  if (session) return <Navigate to="/dashboard" replace />;
  if (!role) return <Navigate to="/" replace />;
  return <LoginForRole role={role} />;
}

function SignUpForRole({ role }: { role: RoleDefinition }) {
  return <SignUpScreen {...useSignUpPresenter(role)} />;
}

export function SignUpPage() {
  const { session } = useSession();
  const role = findRole(useParams().roleKey);
  if (session) return <Navigate to="/dashboard" replace />;
  if (!role) return <Navigate to="/" replace />;
  if (!role.selfSignUp) return <Navigate to={`/login/${role.key}`} replace />;
  return <SignUpForRole role={role} />;
}

function DashboardForSession({ session }: { session: Session }) {
  return <DashboardScreen {...useDashboardPresenter(session)} />;
}

export function DashboardPage() {
  const { session } = useSession();
  if (!session) return <Navigate to="/" replace />;
  return <DashboardForSession session={session} />;
}
