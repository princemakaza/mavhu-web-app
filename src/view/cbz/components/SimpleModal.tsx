import { useState } from 'react';

export interface SimpleField {
  key: string;
  label: string;
  initial?: string;
  options?: readonly string[];
  textarea?: boolean;
  type?: 'text' | 'date' | 'number';
  required?: boolean;
}

/** A small modal form for one-off actions (close, re-rate, reject, tag…). */
export function SimpleModal({
  title,
  subtitle,
  fields,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle?: string;
  fields: SimpleField[];
  submitLabel: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ''])));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = fields.filter((f) => f.required && !values[f.key]?.trim());
    if (missing.length) {
      setError(`Fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cbz-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cbz-modal">
        <header className="cbz-modal__head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="cbz-muted">{subtitle}</p>}
          </div>
          <button type="button" className="cbz-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form className="cbz-modal__body" onSubmit={submit}>
          <div className="cbz-grid cbz-grid--form">
            {fields.map((f) => (
              <label key={f.key} className={`cbz-field ${f.textarea ? 'cbz-field--wide' : ''}`}>
                <span>
                  {f.label}
                  {f.required ? ' *' : ''}
                </span>
                {f.options ? (
                  <select value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.textarea ? (
                  <textarea rows={3} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                ) : (
                  <input type={f.type ?? 'text'} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                )}
              </label>
            ))}
          </div>
          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
          <footer className="cbz-modal__foot">
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cbz-btn cbz-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : submitLabel}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

