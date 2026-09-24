import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../model/api/authService';
import { ApiError } from '../model/api/httpClient';
import type { RoleDefinition } from '../model/roles';
import { useSession } from './SessionContext';

export function useLoginPresenter(role: RoleDefinition) {
  const navigate = useNavigate();
  const { startSession } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const auth = await authService.login({ email: email.trim(), password });
      if (!auth.user.roles.includes(role.apiName)) {
        setError(`This account is not registered as ${role.label}. Go back and choose the role assigned to you.`);
        return;
      }
      await startSession(auth, role.key);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Incorrect email or password.' : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return {
    role,
    email,
    password,
    showPassword,
    error,
    submitting,
    setEmail,
    setPassword,
    toggleShowPassword: () => setShowPassword((visible) => !visible),
    submit,
  };
}

export type LoginViewModel = ReturnType<typeof useLoginPresenter>;
