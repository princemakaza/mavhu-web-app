import { useEffect, useRef, useState } from 'react';
import {
  apiImportFile,
  downloadImportTemplate,
  fetchImportDatasets,
  type ImportDatasets,
  type ImportResult,
  type ImportSheetResult,
} from '../../../model/cbz/cbz_api';

const STATUS_BADGE: Record<ImportSheetResult['status'], { cls: string; label: string }> = {
  ready: { cls: 'success', label: 'Ready' },
  imported: { cls: 'success', label: 'Imported' },
  partial: { cls: 'partial', label: 'Partly imported' },
  failed: { cls: 'failure', label: 'Nothing valid' },
  skipped: { cls: 'partial', label: 'Not imported' },
  empty: { cls: 'partial', label: 'Empty' },
};

/**
 * Upload an .xlsx workbook (same layout as the ESG sample dataset) or a CSV of one sheet.
 * Step 1 validates on the server without saving; step 2 imports the valid rows.
 */
export function BulkImport({ onImported }: { onImported: () => Promise<void> | void }) {
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<'validating' | 'importing' | 'template' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formats, setFormats] = useState<ImportDatasets | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchImportDatasets().then(setFormats).catch(() => setFormats(null));
  }, []);

  async function validate(next: File | null = file) {
    if (!next) return;
    setBusy('validating');
    setError(null);
    setResult(null);
    try {
      setResult(await apiImportFile(next, { dryRun: true, period: period.trim() || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file.');
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!file) return;
    setBusy('importing');
    setError(null);
    try {
      setResult(await apiImportFile(file, { dryRun: false, period: period.trim() || undefined }));
      await onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed; nothing was saved.');
    } finally {
      setBusy(null);
    }
  }

  async function template() {
    setBusy('template');
    setError(null);
    try {
      await downloadImportTemplate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the template.');
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const imported = result && !result.dryRun;
  const importable = result?.sheets.filter((s) => s.dataset) ?? [];

  return (
    <div className="cbz-form">
      <div className="cbz-toolbar">
        <button type="button" className="cbz-btn cbz-btn--ghost" onClick={template} disabled={busy !== null}>
          {busy === 'template' ? 'Preparing…' : 'Download Excel template'}
        </button>
        <span className="cbz-muted">Same layout as the ESG sample dataset, with your subsidiary codes in the drop-downs.</span>
      </div>

      <div className="cbz-file-drop">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            setFile(next);
            void validate(next);
          }}
        />
        <div className="cbz-file-drop__label">
          <strong>Drop an Excel workbook (.xlsx) or a CSV, or click to browse.</strong>
          <p className="cbz-muted">
            Every sheet is recognised by its column headers (title in row 1, headers in row 2). The file is checked first;
            nothing is saved until you press Import.
          </p>
        </div>
      </div>

      <div className="cbz-grid cbz-grid--form">
        <label className="cbz-field">
          <span>Default period (optional)</span>
          <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-Q3" />
        </label>
        <p className="cbz-muted">Used only for rows with no period of their own (e.g. a Financed Emissions sheet without a Period column).</p>
      </div>

      {busy === 'validating' && <p className="cbz-alert cbz-alert--info">Checking {file?.name}…</p>}
      {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}

      {result && (
        <>
          <p className={`cbz-alert cbz-alert--${imported ? (result.totals.rejected ? 'info' : 'success') : 'info'}`}>
            {imported ? (
              <>
                Imported into <strong>{result.bankName}</strong>: {result.totals.created} new, {result.totals.updated} updated
                {result.totals.rejected ? `, ${result.totals.rejected} rows rejected (listed below)` : ''}. Emission records start as
                draft and go through the approval workflow.
              </>
            ) : (
              <>
                <strong>{result.fileName}</strong>: {result.totals.valid} of {result.totals.rows} rows are ready ({result.totals.created} new,{' '}
                {result.totals.updated} updates){result.totals.rejected ? `; ${result.totals.rejected} will be skipped` : ''}. Nothing has been saved yet.
              </>
            )}
          </p>

          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Sheet</th>
                  <th>Recognised as</th>
                  <th className="cbz-num">Rows</th>
                  <th className="cbz-num">New</th>
                  <th className="cbz-num">Update</th>
                  <th className="cbz-num">Rejected</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.sheets.map((s) => (
                  <tr key={s.sheet}>
                    <td>{s.sheet}</td>
                    <td className={s.dataset ? undefined : 'cbz-muted'}>{s.dataset ? s.label : s.reason}</td>
                    <td className="cbz-num">{s.dataset ? s.totalRows : '—'}</td>
                    <td className="cbz-num">{s.dataset ? s.toCreate : '—'}</td>
                    <td className="cbz-num">{s.dataset ? s.toUpdate : '—'}</td>
                    <td className="cbz-num">{s.dataset ? s.rejected : '—'}</td>
                    <td>
                      <span className={`cbz-badge cbz-badge--ingest-${STATUS_BADGE[s.status].cls}`}>{STATUS_BADGE[s.status].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importable
            .filter((s) => s.errors.length || s.warnings.length || s.notes.length)
            .map((s) => (
              <details key={s.sheet} className="cbz-details" open={s.errors.length > 0 && s.errors.length <= 10}>
                <summary>
                  {s.sheet}: {s.errors.length ? `${s.rejected} rejected row(s)` : 'no rejected rows'}
                  {s.warnings.length ? ` · ${s.warnings.length} warning(s)` : ''}
                </summary>
                {s.notes.map((n) => (
                  <p key={n} className="cbz-muted">
                    {n}
                  </p>
                ))}
                {(s.errors.length > 0 || s.warnings.length > 0) && (
                  <div className="cbz-table-wrap">
                    <table className="cbz-table cbz-table--compact">
                      <thead>
                        <tr>
                          <th className="cbz-num">Row</th>
                          <th>Column</th>
                          <th>Issue</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...s.errors.map((e) => ({ ...e, kind: 'error' })), ...s.warnings.map((w) => ({ ...w, kind: 'warning' }))]
                          .sort((a, b) => a.row - b.row)
                          .map((issue, i) => (
                            <tr key={i} className={issue.kind === 'error' ? 'cbz-row--error' : undefined}>
                              <td className="cbz-num">{issue.row}</td>
                              <td>{issue.column ?? '—'}</td>
                              <td>
                                <span className={`cbz-badge cbz-badge--ingest-${issue.kind === 'error' ? 'failure' : 'partial'}`}>{issue.code}</span>
                              </td>
                              <td>{issue.message}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            ))}

          <div className="cbz-form__actions">
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={reset} disabled={busy !== null}>
              {imported ? 'Upload another file' : 'Discard'}
            </button>
            {!imported && (
              <>
                <button type="button" className="cbz-btn cbz-btn--ghost" onClick={() => validate()} disabled={busy !== null}>
                  Re-check
                </button>
                <button type="button" className="cbz-btn cbz-btn--primary" onClick={commit} disabled={busy !== null || result.totals.valid === 0}>
                  {busy === 'importing' ? 'Importing…' : `Import ${result.totals.valid} valid row(s)`}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {formats && (
        <details className="cbz-details">
          <summary>What can I upload?</summary>
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Sheet name</th>
                  <th>Holds</th>
                  <th>Required columns</th>
                </tr>
              </thead>
              <tbody>
                {formats.datasets.map((d) => (
                  <tr key={d.key}>
                    <td>{d.sheet}</td>
                    <td>{d.label}</td>
                    <td className="cbz-muted">
                      {d.columns
                        .filter((c) => c.required)
                        .map((c) => c.header)
                        .join(', ')}
                    </td>
                  </tr>
                ))}
                {formats.notImported.map((d) => (
                  <tr key={d.sheet}>
                    <td>{d.sheet}</td>
                    <td className="cbz-muted" colSpan={2}>
                      Not imported: {d.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
