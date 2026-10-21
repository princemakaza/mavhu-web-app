import { useState } from 'react';
import { apiUploadEvidence } from '../../../model/cbz/cbz_api';
import { useCbzData } from '../../../model/cbz/CbzDataContext';

export const EVIDENCE_TARGETS = ['EmissionRecord', 'Counterparty', 'InsurancePolicy', 'RiskEntry', 'Incident', 'Register', 'Disclosure', 'Period', 'Other'];
const ACCEPT = '.pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.png,.jpg,.jpeg,.json,.geojson,.pptx';

/** Attach a source document to a record (F38). The server stores it with its SHA-256. */
export function EvidenceUploadModal({
  targetType,
  targetId,
  entityCode,
  title,
  onClose,
  onUploaded,
}: {
  targetType?: string;
  targetId?: string;
  entityCode?: string | null;
  title?: string;
  onClose: () => void;
  onUploaded?: () => void;
}) {
  const { state, me } = useCbzData();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState(targetType ?? 'Other');
  const [target, setTarget] = useState(targetId ?? '');
  const [entity, setEntity] = useState(entityCode ?? (me?.role === 'contributor' || me?.role === 'customer' ? (me.entityCode ?? '') : ''));
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Choose a file');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiUploadEvidence(file, { targetType: type, targetId: target || undefined, entityCode: entity || undefined, description });
      onUploaded?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cbz-modal-backdrop" role="dialog" aria-modal="true" aria-label="Attach evidence">
      <div className="cbz-modal">
        <header className="cbz-modal__head">
          <div>
            <h3>{title ?? 'Attach evidence'}</h3>
            <p className="cbz-muted">PDF, Excel, CSV, Word, images or GeoJSON up to 15 MB. A SHA-256 fingerprint is kept so later changes are detectable.</p>
          </div>
          <button type="button" className="cbz-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form className="cbz-modal__body" onSubmit={submit}>
          <label className="cbz-field cbz-field--wide">
            <span>File *</span>
            <input type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="cbz-grid cbz-grid--form">
            <label className="cbz-field">
              <span>Supports</span>
              <select value={type} onChange={(e) => setType(e.target.value)} disabled={Boolean(targetType)}>
                {EVIDENCE_TARGETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field">
              <span>Record ID</span>
              <input value={target} onChange={(e) => setTarget(e.target.value)} disabled={Boolean(targetId)} placeholder="Optional" />
            </label>
            <label className="cbz-field">
              <span>Subsidiary</span>
              <select value={entity} onChange={(e) => setEntity(e.target.value)} disabled={Boolean(entityCode) || me?.role === 'contributor' || me?.role === 'customer'}>
                <option value="">Group</option>
                {state.entities.map((en) => (
                  <option key={en.code} value={en.code}>
                    {en.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field cbz-field--wide">
              <span>Description</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Fuel card statement, September 2026" />
            </label>
          </div>
          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
          <footer className="cbz-modal__foot">
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cbz-btn cbz-btn--primary" disabled={saving}>
              {saving ? 'Uploading…' : 'Attach'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
