// ESG evidence & document repository (F38).
import { useEffect, useMemo, useState } from 'react';
import { downloadEvidence, fetchEvidence } from '../../../model/cbz/cbz_api';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import type { EntityCode, EvidenceFile } from '../../../model/cbz/types';
import { EVIDENCE_TARGETS, EvidenceUploadModal } from '../components/EvidenceUpload';
import { EmptyState, Panel, StatCard, fmtDateTime } from '../components/primitives';

export function EvidenceTab({ scope }: { scope: EntityCode }) {
  const { can } = useCbzData();
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = () =>
    fetchEvidence()
      .then(setFiles)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return files.filter(
      (f) =>
        (scope === 'GROUP' || !f.entityCode || f.entityCode === scope) &&
        (type === 'all' || f.targetType === type) &&
        (!term || `${f.fileName} ${f.description} ${f.targetId ?? ''} ${f.uploadedBy}`.toLowerCase().includes(term)),
    );
  }, [files, scope, type, search]);

  const size = rows.reduce((s, f) => s + f.sizeBytes, 0);

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Evidence files" value={String(rows.length)} hint={`${(size / 1024 / 1024).toFixed(2)} MB`} />
        <StatCard label="Linked to records" value={String(rows.filter((f) => f.targetId).length)} hint="Traceable to a data point" intent="positive" />
        <StatCard label="Record types covered" value={String(new Set(rows.map((f) => f.targetType)).size)} />
        <StatCard label="Integrity" value="SHA-256" hint="Checked on every download" />
      </div>
      <Panel
        title="Evidence repository"
        subtitle="Source documents tied to the records they support, retrievable by auditors. Every upload is fingerprinted and logged (F38)."
        action={
          <div className="cbz-toolbar">
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Record type">
              <option value="all">All record types</option>
              {EVIDENCE_TARGETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files" aria-label="Search files" />
            {can('submit-data') && (
              <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setUploading(true)}>
                + Upload evidence
              </button>
            )}
          </div>
        }
        padded={false}
      >
        {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Supports</th>
                <th>Entity</th>
                <th className="cbz-num">Size</th>
                <th>Uploaded</th>
                <th>SHA-256</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td>
                    <div>{f.fileName}</div>
                    {f.description && <div className="cbz-muted">{f.description}</div>}
                  </td>
                  <td>
                    {f.targetType}
                    {f.targetId && <div className="cbz-mono cbz-muted">{f.targetId.slice(0, 18)}</div>}
                  </td>
                  <td>{f.entityCode ?? 'Group'}</td>
                  <td className="cbz-num">{(f.sizeBytes / 1024).toFixed(1)} KB</td>
                  <td>
                    <div>{fmtDateTime(f.uploadedAt)}</div>
                    <div className="cbz-muted">{f.uploadedBy}</div>
                  </td>
                  <td className="cbz-mono cbz-muted" title={f.sha256}>
                    {f.sha256.slice(0, 12)}…
                  </td>
                  <td>
                    <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => downloadEvidence(f).catch((e) => setError(String(e)))}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="No evidence files yet." hint="Attach source files from the Workflow tab or upload them here." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {uploading && <EvidenceUploadModal onClose={() => setUploading(false)} onUploaded={() => void load()} />}
    </>
  );
}
