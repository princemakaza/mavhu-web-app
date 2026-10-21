import { useMemo, useState, type ReactNode } from 'react';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import type { RegisterDef, RegisterField, RegisterItem } from '../../../model/cbz/types';
import { useRegister, useRegisterDefs } from '../../../model/cbz/useRegister';
import { EmptyState, Panel } from './primitives';

export interface RegisterColumn {
  key: string;
  label: string;
  render?: (item: RegisterItem) => ReactNode;
  numeric?: boolean;
}

interface Props {
  register: string;
  title?: string;
  subtitle?: string;
  /** Columns to show; defaults to the first five fields. */
  columns?: RegisterColumn[];
  /** Extra per-row actions (e.g. "Escalate"). */
  rowActions?: (item: RegisterItem) => ReactNode;
  /** Content above the table (stats, charts) that needs the loaded rows. */
  header?: (items: RegisterItem[]) => ReactNode;
  /** Prefill for "Add". */
  defaults?: Record<string, unknown>;
  /** Only show rows in this subsidiary (plus Group-level rows) when a subsidiary is selected. */
  scope?: string;
}

/** A register table with add/edit/delete generated from the server's field definitions. */
export function RegisterView({ register, title, subtitle, columns, rowActions, header, defaults, scope }: Props) {
  const defs = useRegisterDefs();
  const def = defs.find((d) => d.key === register);
  const { items, loading, error, create, update, remove } = useRegister(register);
  const { can, state } = useCbzData();
  const [editing, setEditing] = useState<RegisterItem | 'new' | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const canWrite = def ? can(def.write) : false;
  const canDelete = can('manage-registers');
  const visible = useMemo(
    () => items.filter((i) => !scope || scope === 'GROUP' || !i.entityCode || i.entityCode === scope),
    [items, scope],
  );
  const cols: RegisterColumn[] =
    columns ?? (def?.fields.slice(0, 5).map((f) => ({ key: f.key, label: f.label, numeric: ['number', 'int', 'score', 'share'].includes(f.type) })) ?? []);
  const entityName = (code: string | null) => (code ? (state.entities.find((e) => e.code === code)?.name ?? code) : 'Group');

  return (
    <>
      {header?.(visible)}
      <Panel
        title={title ?? def?.label ?? register}
        subtitle={subtitle ?? (def ? `RFP ${def.rfp}` : undefined)}
        action={
          canWrite ? (
            <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setEditing('new')}>
              + Add
            </button>
          ) : (
            <span className="cbz-pill cbz-pill--frame">Read-only for your role</span>
          )
        }
        padded={false}
      >
        {(error || rowError) && <p className="cbz-alert cbz-alert--danger">{error ?? rowError}</p>}
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className={c.numeric ? 'cbz-num' : undefined}>
                    {c.label}
                  </th>
                ))}
                {def?.entityScoped && <th>Subsidiary</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  {cols.map((c) => (
                    <td key={c.key} className={c.numeric ? 'cbz-num' : undefined}>
                      {c.render ? c.render(item) : formatCell(item.data[c.key])}
                    </td>
                  ))}
                  {def?.entityScoped && <td className="cbz-muted">{entityName(item.entityCode)}</td>}
                  <td>
                    <div className="cbz-toolbar cbz-toolbar--end">
                      {rowActions?.(item)}
                      {canWrite && (
                        <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => setEditing(item)}>
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="cbz-btn cbz-btn--sm cbz-btn--ghost"
                          onClick={async () => {
                            if (!window.confirm('Remove this entry? Its content stays in the audit trail.')) return;
                            setRowError(null);
                            try {
                              await remove(item.id);
                            } catch (err) {
                              setRowError(err instanceof Error ? err.message : 'Could not remove');
                            }
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 2}>
                    <EmptyState title="Nothing recorded yet." hint={canWrite ? 'Use + Add to create the first entry.' : undefined} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {editing && def && (
        <RegisterForm
          def={def}
          item={editing === 'new' ? null : editing}
          defaults={defaults}
          onClose={() => setEditing(null)}
          onSave={async (data, entityCode) => {
            if (editing === 'new') await create(data, entityCode);
            else await update(editing.id, data, entityCode);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function formatCell(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return <span className="cbz-muted">—</span>;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  return String(value);
}

export function RegisterForm({
  def,
  item,
  defaults,
  onClose,
  onSave,
}: {
  def: RegisterDef;
  item: RegisterItem | null;
  defaults?: Record<string, unknown>;
  onClose: () => void;
  onSave: (data: Record<string, unknown>, entityCode: string | null) => Promise<void>;
}) {
  const { state, me } = useCbzData();
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...(defaults ?? {}), ...(item?.data ?? {}) }));
  const [entityCode, setEntityCode] = useState<string>(item?.entityCode ?? (me?.role === 'contributor' ? (me.entityCode ?? '') : ''));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(values, def.entityScoped ? entityCode || null : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cbz-modal-backdrop" role="dialog" aria-modal="true" aria-label={def.label}>
      <div className="cbz-modal cbz-modal--wide">
        <header className="cbz-modal__head">
          <div>
            <h3>
              {item ? 'Edit' : 'Add to'} {def.label}
            </h3>
            <p className="cbz-muted">RFP {def.rfp} · every change is recorded in the audit trail.</p>
          </div>
          <button type="button" className="cbz-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form className="cbz-modal__body" onSubmit={submit}>
          <div className="cbz-grid cbz-grid--form">
            {def.entityScoped && (
              <label className="cbz-field">
                <span>Subsidiary</span>
                <select value={entityCode} onChange={(e) => setEntityCode(e.target.value)} disabled={me?.role === 'contributor'}>
                  <option value="">Group-level</option>
                  {state.entities.map((en) => (
                    <option key={en.code} value={en.code}>
                      {en.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {def.fields.map((f) => (
              <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))} />
            ))}
          </div>
          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
          <footer className="cbz-modal__foot">
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cbz-btn cbz-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: RegisterField; value: unknown; onChange: (v: unknown) => void }) {
  const label = `${field.label}${field.required ? ' *' : ''}`;
  if (field.type === 'bool') {
    return (
      <label className="cbz-check cbz-field--checkbox">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  }
  if (field.options) {
    return (
      <label className="cbz-field">
        <span>{label}</span>
        <select value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} required={field.required}>
          {!field.required && <option value="">—</option>}
          {field.required && value === undefined && <option value="">Choose…</option>}
          {field.options.filter((o) => o !== '').map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const numeric = ['number', 'int', 'score', 'share'].includes(field.type);
  if (field.type === 'text') {
    return (
      <label className="cbz-field cbz-field--wide">
        <span>{label}</span>
        <textarea rows={3} value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  return (
    <label className="cbz-field">
      <span>{label}</span>
      <input
        type={field.type === 'date' ? 'date' : numeric ? 'number' : 'text'}
        step={field.type === 'share' ? '0.01' : field.type === 'number' ? 'any' : undefined}
        min={field.type === 'score' ? 1 : field.type === 'share' ? 0 : undefined}
        max={field.type === 'score' ? 5 : field.type === 'share' ? 1 : undefined}
        value={value === undefined || value === null ? '' : String(value)}
        required={field.required}
        onChange={(e) => onChange(numeric ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      />
    </label>
  );
}
