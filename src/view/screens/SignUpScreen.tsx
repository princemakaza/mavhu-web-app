import { Link } from 'react-router-dom';
import type { SignUpViewModel } from '../../presenter/useSignUpPresenter';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordField, SelectField, TextField } from '../components/Fields';
import { ArrowLeftIcon, RoleIcon } from '../components/Icons';

export function SignUpScreen(vm: SignUpViewModel) {
  const { role, fields, fieldErrors } = vm;

  const organizationHint =
    vm.organizationsState === 'loading'
      ? 'Loading organisations…'
      : vm.organizationsState === 'failed'
        ? 'Could not load organisations. Refresh to try again.'
        : undefined;

  return (
    <AuthLayout>
      <Link to={`/login/${role.key}`} className="back-link">
        <ArrowLeftIcon /> Back to sign in
      </Link>

      <div className="form-card">
        <div className="role-tag">
          <span className="role-tag__icon">
            <RoleIcon role={role.key} />
          </span>
          {role.label}
        </div>
        <h2>Create your account</h2>
        <p className="form-card__lead">{role.summary}</p>

        <form onSubmit={vm.submit} noValidate>
          {vm.error && (
            <div className="alert" role="alert">
              {vm.error}
            </div>
          )}
          <TextField
            label="Full name"
            autoComplete="name"
            placeholder="Tendai Moyo"
            value={fields.name}
            error={fieldErrors.name}
            onChange={(value) => vm.setField('name', value)}
            autoFocus
          />
          <SelectField
            label="Organisation"
            value={fields.organizationId}
            error={fieldErrors.organizationId}
            hint={organizationHint}
            disabled={vm.organizationsState !== 'ready'}
            onChange={(value) => vm.setField('organizationId', value)}
          >
            <option value="">Select your organisation</option>
            {vm.organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="you@company.co.zw"
            value={fields.email}
            error={fieldErrors.email}
            onChange={(value) => vm.setField('email', value)}
          />
          <PasswordField
            label="Password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={fields.password}
            error={fieldErrors.password}
            onChange={(value) => vm.setField('password', value)}
            visible={vm.showPassword}
            onToggleVisible={vm.toggleShowPassword}
          />
          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={fields.confirmPassword}
            error={fieldErrors.confirmPassword}
            onChange={(value) => vm.setField('confirmPassword', value)}
            visible={vm.showPassword}
            onToggleVisible={vm.toggleShowPassword}
          />
          <button type="submit" className="button" disabled={vm.submitting}>
            {vm.submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="form-card__footer">
          Already have an account? <Link to={`/login/${role.key}`}>Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
