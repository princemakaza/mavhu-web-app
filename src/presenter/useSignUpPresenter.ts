import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../model/api/authService';
import { organizationService } from '../model/api/organizationService';
import type { RoleDefinition } from '../model/roles';
import type { Organization } from '../model/types';
import { useSession } from './SessionContext';

export interface SignUpFields {
  name: string;
  organizationId: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type FieldErrors = Partial<Record<keyof SignUpFields, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields: SignUpFields): FieldErrors {
  const errors: FieldErrors = {};
  if (!fields.name.trim()) errors.name = 'Enter your full name.';
  if (!fields.organizationId) errors.organizationId = 'Select your organisation.';
  if (!EMAIL_PATTERN.test(fields.email.trim())) errors.email = 'Enter a valid email address.';
  if (fields.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (fields.confirmPassword !== fields.password) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export function useSignUpPresenter(role: RoleDefinition) {
  const navigate = useNavigate();
  const { startSession } = useSession();
  const [fields, setFields] = useState<SignUpFields>({
    name: '',
    organizationId: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationsState, setOrganizationsState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    organizationService
      .listJoinable()
      .then((list) => {
        if (cancelled) return;
        setOrganizations(list);
        setOrganizationsState('ready');
      })
      .catch(() => !cancelled && setOrganizationsState('failed'));
    return () => {
      cancelled = true;
    };
  }, []);

  function setField(field: keyof SignUpFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const errors = validate(fields);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const auth = await authService.register({
        name: fields.name.trim(),
        email: fields.email.trim(),
        password: fields.password,
        customerId: Number(fields.organizationId),
        roleNames: [role.apiName],
      });
      await startSession(auth, role.key);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return {
    role,
    fields,
    fieldErrors,
    organizations,
    organizationsState,
    showPassword,
    error,
    submitting,
    setField,
    toggleShowPassword: () => setShowPassword((visible) => !visible),
    submit,
  };
}

export type SignUpViewModel = ReturnType<typeof useSignUpPresenter>;
