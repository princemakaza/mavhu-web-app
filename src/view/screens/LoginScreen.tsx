import { Link } from 'react-router-dom';
import type { LoginViewModel } from '../../presenter/useLoginPresenter';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordField, TextField } from '../components/Fields';
import { ArrowLeftIcon, RoleIcon } from '../components/Icons';

export function LoginScreen(vm: LoginViewModel) {
  const { role } = vm;

  return (
    <AuthLayout>
      <Link to="/" className="back-link">
        <ArrowLeftIcon /> Change role
      </Link>

      <div className="form-card">
        <div className="role-tag">
          <span className="role-tag__icon">
            <RoleIcon role={role.key} />
          </span>
          {role.label}
        </div>
        <h2>Sign in</h2>
        <p className="form-card__lead">Welcome back. Enter your details to continue.</p>

        <form onSubmit={vm.submit} noValidate>
          {vm.error && (
            <div className="alert" role="alert">
              {vm.error}
            </div>
          )}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@company.co.zw"
            value={vm.email}
            onChange={vm.setEmail}
            autoFocus
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            placeholder="Your password"
            value={vm.password}
            onChange={vm.setPassword}
            visible={vm.showPassword}
            onToggleVisible={vm.toggleShowPassword}
          />
          <button type="submit" className="button" disabled={vm.submitting}>
            {vm.submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="form-card__footer">
          {role.selfSignUp ? (
            <>
              New to Mavhu? <Link to={`/signup/${role.key}`}>Create an account</Link>
            </>
          ) : (
            <>{role.label} accounts are created by Mavhu Africa. Contact your administrator if you need access.</>
          )}
        </p>
      </div>
    </AuthLayout>
  );
}
