import type { FormEvent, ReactNode } from 'react';
import type { BankStatus, MemberRole } from '../../model/admin/types';

export function BankStatusBadge({ status }: { status: BankStatus }) {
  return <span className={`cbz-badge cbz-badge--bank-${status}`}>{status}</span>;
}

export function RoleChip({ role }: { role: MemberRole | string }) {
  return <span className={`cbz-chip cbz-chip--role cbz-chip--role-${role}`}>{role}</span>;
}

export function Loading() {
  return <p className="cbz-muted">Loading…</p>;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="cbz-alert cbz-alert--danger cbz-admin-banner">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel,
  submitting,
  error,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit?: (e: FormEvent) => void;
  submitLabel?: string;
  submitting?: boolean;
  error?: string | null;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="cbz-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`cbz-modal ${wide ? 'cbz-modal--wide' : ''}`}>
        <header className="cbz-modal__head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="cbz-muted">{subtitle}</p>}
          </div>
          <button type="button" className="cbz-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form
          className="cbz-modal__body"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.(e);
          }}
        >
          {children}
          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
          <footer className="cbz-modal__foot">
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={onClose}>
              {onSubmit ? 'Cancel' : 'Close'}
            </button>
            {onSubmit && (
              <button type="submit" className="cbz-btn cbz-btn--primary" disabled={submitting}>
                {submitting ? 'Saving…' : submitLabel ?? 'Save'}
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'No activity yet';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
