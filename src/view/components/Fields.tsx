import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { EyeIcon, EyeOffIcon } from './Icons';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}

function FieldShell({ label, error, hint, htmlFor, children }: FieldShellProps) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <p className="field__message field__message--error" id={`${htmlFor}-msg`}>
          {error}
        </p>
      ) : hint ? (
        <p className="field__message" id={`${htmlFor}-msg`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
}

export function TextField({ label, error, hint, onChange, ...input }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
      <input
        {...input}
        id={id}
        className="input"
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

interface PasswordFieldProps extends Omit<TextFieldProps, 'type'> {
  visible: boolean;
  onToggleVisible: () => void;
}

export function PasswordField({ label, error, hint, onChange, visible, onToggleVisible, ...input }: PasswordFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
      <div className="input-wrap">
        <input
          {...input}
          id={id}
          type={visible ? 'text' : 'password'}
          className="input input--with-action"
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="input-wrap__action"
          onClick={onToggleVisible}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </FieldShell>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
}

export function SelectField({ label, error, hint, onChange, children, ...select }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
      <select
        {...select}
        id={id}
        className="input input--select"
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </FieldShell>
  );
}
