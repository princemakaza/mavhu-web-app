import { useMemo, useRef, useState } from 'react';
import { cbzStore } from '../../../model/cbz/store';
import { useCbz } from '../../../model/cbz/useCbz';
import type { CbzSession, EmissionRecord, EntityCode, Scope } from '../../../model/cbz/types';
import { EmptyState, Panel, StatCard, StatusBadge, fmtDateTime, fmtT } from '../components/primitives';

type UnitPreset = {
  scope: Scope;
  dataset: string;
  units: string[];
  factor: number;
  method: EmissionRecord['method'];
};

// Emission-factor library — matches the illustrative factors in the CBZ sample
// dataset. Real system reads these from the reference-data endpoint.
const PRESETS: UnitPreset[] = [
  { scope: 'scope1', dataset: 'Fleet fuel — Diesel', units: ['litres'], factor: 2.68, method: 'activity-based' },
  { scope: 'scope1', dataset: 'Fleet fuel — Petrol', units: ['litres'], factor: 2.31, method: 'activity-based' },
  { scope: 'scope1', dataset: 'Backup generator — Diesel', units: ['litres'], factor: 2.68, method: 'activity-based' },
  { scope: 'scope1', dataset: 'Refrigerant top-up — R410A', units: ['kg'], factor: 2088, method: 'activity-based' },
  { scope: 'scope1', dataset: 'Refrigerant top-up — R134a', units: ['kg'], factor: 1430, method: 'activity-based' },
  { scope: 'scope2', dataset: 'Grid electricity (location-based)', units: ['kWh'], factor: 0.65, method: 'activity-based' },
  { scope: 'scope2', dataset: 'Grid electricity (market-based, residual mix)', units: ['kWh'], factor: 0.9, method: 'activity-based' },
  { scope: 'scope3', dataset: 'Cat 1 — Procurement (spend-based)', units: ['US$'], factor: 0.35, method: 'spend-based' },
  { scope: 'scope3', dataset: 'Cat 1 — Agri-inputs (spend-based)', units: ['US$'], factor: 0.55, method: 'spend-based' },
  { scope: 'scope3', dataset: 'Cat 2 — Capex (spend-based)', units: ['US$'], factor: 0.4, method: 'spend-based' },
  { scope: 'scope3', dataset: 'Cat 3 — T&D losses', units: ['kWh'], factor: 0.045, method: 'activity-based' },
  { scope: 'scope3', dataset: 'Cat 5 — Waste', units: ['tonnes'], factor: 21, method: 'activity-based' },
  { scope: 'scope3', dataset: 'Cat 6 — Business travel', units: ['pax-km'], factor: 0.15, method: 'activity-based' },
  { scope: 'scope3', dataset: 'Cat 7 — Employee commuting', units: ['employees'], factor: 0.85, method: 'activity-based' },
  { scope: 'scope3', dataset: 'Cat 8 — Leased assets', units: ['m2'], factor: 0.06, method: 'activity-based' },
  { scope: 'scope3', dataset: 'Cat 13 — Downstream leased assets', units: ['m2'], factor: 0.06, method: 'activity-based' },
];

export function DataEntryTab({ session, scope }: { session: CbzSession; scope: EntityCode }) {
  const state = useCbz();
  const [tab, setTab] = useState<'form' | 'file'>('form');
  const [preset, setPreset] = useState(0);
  const [site, setSite] = useState('Head Office');
  const [period, setPeriod] = useState('2026-09');
  const [activity, setActivity] = useState('');
  const [dq, setDq] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetEntity: EntityCode = scope === 'GROUP' ? session.entityCode : scope;
  const p = PRESETS[preset];

  const previewTons = useMemo(() => {
    const val = Number.parseFloat(activity);
    if (!Number.isFinite(val) || val <= 0) return 0;
    return (val * p.factor) / 1000;
  }, [activity, p.factor]);

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const val = Number.parseFloat(activity);
    if (!Number.isFinite(val) || val <= 0) {
      setError('Activity data must be a positive number.');
      return;
    }
    if (!site.trim()) {
      setError('Site is required.');
      return;
    }
    try {
      const record = cbzStore.addEmission(
        {
          entityCode: targetEntity,
          site: site.trim(),
          period,
          scope: p.scope,
          datasetType: p.dataset,
          activityData: val,
          unit: p.units[0],
          emissionFactorKgPerUnit: p.factor,
          emissionsKgCo2e: +(val * p.factor).toFixed(3),
          emissionsTco2e: +((val * p.factor) / 1000).toFixed(4),
          method: p.method,
          dataQuality: dq,
          sourceRef: notes.trim() || `Manual entry via dashboard — ${session.fullName}`,
          submittedBy: session.memberId,
          status: 'draft',
        },
        session.fullName,
      );
      setSuccess(`Saved ${record.id} · ${record.emissionsTco2e.toFixed(3)} tCO2e for ${record.entityCode} (${record.period}).`);
      setActivity('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save record.');
    }
  }

  function handleFile(fileList: FileList | null) {
    setParseError(null);
    setParsedRows(null);
    const file = fileList?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const rows = parseCsv(text);
        setParsedRows(rows);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Could not parse file.');
      }
    };
    reader.onerror = () => setParseError('Could not read file.');
    reader.readAsText(file);
  }

  function commitBatch() {
    if (!parsedRows || parsedRows.length === 0) return;
    let saved = 0;
    let rejected = 0;
    const details: string[] = [];
    for (const row of parsedRows) {
      if (row.error) {
        rejected += 1;
        details.push(`${row.rowNumber}: ${row.error}`);
        continue;
      }
      const emissionsKg = row.activity! * row.factor!;
      cbzStore.addEmission(
        {
          entityCode: row.entity!,
          site: row.site!,
          period: row.period!,
          scope: row.scope!,
          datasetType: row.datasetType!,
          activityData: row.activity!,
          unit: row.unit!,
          emissionFactorKgPerUnit: row.factor!,
          emissionsKgCo2e: emissionsKg,
          emissionsTco2e: emissionsKg / 1000,
          method: 'activity-based',
          dataQuality: (row.dq ?? 3) as 1 | 2 | 3 | 4 | 5,
          sourceRef: fileName ?? 'file upload',
          submittedBy: session.memberId,
          status: 'draft',
        },
        session.fullName,
      );
      saved += 1;
    }
    cbzStore.addIngestionBatch(
      {
        fileName: fileName ?? 'uploaded.csv',
        channel: 'File Ingester (manual upload)',
        subsidiary: targetEntity,
        recordsProcessed: saved,
        validationStatus: rejected === 0 ? 'Success' : saved === 0 ? 'Failure' : 'Partial',
        errorDetails: rejected === 0 ? 'n/a' : details.slice(0, 3).join(' · '),
        notificationSent: rejected > 0,
      },
      session.fullName,
    );
    setFileName(null);
    setParsedRows(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSuccess(`Ingested ${saved} record(s), rejected ${rejected}. Batch logged to audit trail.`);
  }

  const recentBatches = state.ingestion.filter((b) => scope === 'GROUP' || b.subsidiary === scope).slice(0, 6);
  const recentDrafts = state.emissions
    .filter((r) => (scope === 'GROUP' || r.entityCode === scope) && r.submittedBy === session.memberId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 8);

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard
          label="Your submissions"
          value={String(state.emissions.filter((e) => e.submittedBy === session.memberId).length)}
          hint="All-time contribution"
        />
        <StatCard
          label="In review"
          value={String(
            state.emissions.filter((e) => e.submittedBy === session.memberId && e.status === 'in_review').length,
          )}
          hint="Waiting on approver"
          intent="warning"
        />
        <StatCard
          label="Approved"
          value={String(
            state.emissions.filter((e) => e.submittedBy === session.memberId && (e.status === 'approved' || e.status === 'locked')).length,
          )}
          intent="positive"
        />
        <StatCard label="Entity in scope" value={targetEntity} hint="Where your entries will land" />
      </div>

      <Panel
        title="Add emissions data"
        subtitle="Enter a value directly or upload a CSV. Everything you submit lands as draft and needs approval."
      >
        <div className="cbz-tabs">
          <button type="button" className={`cbz-tabs__tab ${tab === 'form' ? 'is-active' : ''}`} onClick={() => setTab('form')}>
            Manual form
          </button>
          <button type="button" className={`cbz-tabs__tab ${tab === 'file' ? 'is-active' : ''}`} onClick={() => setTab('file')}>
            CSV upload
          </button>
        </div>

        {tab === 'form' && (
          <form className="cbz-form" onSubmit={submitForm}>
            <div className="cbz-grid cbz-grid--form">
              <label className="cbz-field">
                <span>Dataset (auto-selects scope, factor, unit)</span>
                <select value={preset} onChange={(e) => setPreset(Number(e.target.value))}>
                  {PRESETS.map((it, idx) => (
                    <option key={it.dataset} value={idx}>
                      {it.scope.toUpperCase()} · {it.dataset}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cbz-field">
                <span>Site / branch</span>
                <input value={site} onChange={(e) => setSite(e.target.value)} required />
              </label>
              <label className="cbz-field">
                <span>Period (YYYY-MM or YYYY-Q#)</span>
                <input value={period} onChange={(e) => setPeriod(e.target.value)} required />
              </label>
              <label className="cbz-field">
                <span>Activity data ({p.units[0]})</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  required
                  placeholder={`e.g. ${p.units[0] === 'kWh' ? '84500' : '2450'}`}
                />
              </label>
              <label className="cbz-field">
                <span>Data quality (1 best · 5 estimate)</span>
                <select value={dq} onChange={(e) => setDq(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>DQ {n}</option>
                  ))}
                </select>
              </label>
              <label className="cbz-field">
                <span>Source reference / notes</span>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Utility bill 2026-09, invoice #4521"
                />
              </label>
            </div>

            <div className="cbz-calc-preview">
              <div>
                <span className="cbz-muted">Method</span>
                <strong>{p.method}</strong>
              </div>
              <div>
                <span className="cbz-muted">Factor</span>
                <strong>{p.factor} kgCO2e / {p.units[0]}</strong>
              </div>
              <div>
                <span className="cbz-muted">Result</span>
                <strong>{fmtT(previewTons, 3)} tCO2e</strong>
              </div>
            </div>

            {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
            {success && <p className="cbz-alert cbz-alert--success">{success}</p>}

            <div className="cbz-form__actions">
              <button type="submit" className="cbz-btn cbz-btn--primary">
                Save as draft
              </button>
            </div>
          </form>
        )}

        {tab === 'file' && (
          <div className="cbz-form">
            <div className="cbz-file-drop">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleFile(e.target.files)}
              />
              <div className="cbz-file-drop__label">
                <strong>Drop a CSV or click to browse.</strong>
                <p className="cbz-muted">
                  Header row required. Columns:{' '}
                  <code>entity_code, site, period, scope, dataset_type, activity_data, unit, emission_factor, data_quality</code>
                </p>
                <p className="cbz-muted">Values are validated per row; the batch is logged to the audit trail whether successful or partial.</p>
              </div>
            </div>

            {fileName && <p className="cbz-alert cbz-alert--info">Reading: <strong>{fileName}</strong></p>}
            {parseError && <p className="cbz-alert cbz-alert--danger">{parseError}</p>}

            {parsedRows && parsedRows.length > 0 && (
              <>
                <div className="cbz-table-wrap">
                  <table className="cbz-table cbz-table--compact">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Entity</th>
                        <th>Site</th>
                        <th>Period</th>
                        <th>Scope</th>
                        <th>Dataset</th>
                        <th className="cbz-num">Activity</th>
                        <th>Unit</th>
                        <th className="cbz-num">Factor</th>
                        <th className="cbz-num">→ tCO2e</th>
                        <th>Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row) => (
                        <tr key={row.rowNumber} className={row.error ? 'cbz-row--error' : ''}>
                          <td>{row.rowNumber}</td>
                          <td>{row.entity ?? '—'}</td>
                          <td>{row.site ?? '—'}</td>
                          <td>{row.period ?? '—'}</td>
                          <td>{row.scope ?? '—'}</td>
                          <td>{row.datasetType ?? '—'}</td>
                          <td className="cbz-num">{row.activity ?? '—'}</td>
                          <td>{row.unit ?? '—'}</td>
                          <td className="cbz-num">{row.factor ?? '—'}</td>
                          <td className="cbz-num">
                            {row.activity && row.factor ? fmtT((row.activity * row.factor) / 1000, 3) : '—'}
                          </td>
                          <td>
                            {row.error ? (
                              <span className="cbz-badge cbz-badge--ingest-failure">{row.error}</span>
                            ) : (
                              <span className="cbz-badge cbz-badge--ingest-success">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="cbz-form__actions">
                  <button type="button" className="cbz-btn cbz-btn--ghost" onClick={() => { setParsedRows(null); setFileName(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                    Discard
                  </button>
                  <button type="button" className="cbz-btn cbz-btn--primary" onClick={commitBatch}>
                    Ingest {parsedRows.filter((r) => !r.error).length} valid rows
                  </button>
                </div>
              </>
            )}

            <details className="cbz-details">
              <summary>See CSV template</summary>
              <pre className="cbz-code">{`entity_code,site,period,scope,dataset_type,activity_data,unit,emission_factor,data_quality
CBZBANK,Harare Head Office,2026-09,scope1,Fleet fuel — Diesel,2350,litres,2.68,2
CBZBANK,Harare Head Office,2026-09,scope2,Grid electricity (location-based),84000,kWh,0.65,2`}</pre>
            </details>
          </div>
        )}
      </Panel>

      <div className="cbz-grid cbz-grid--halves">
        <Panel title="Recent ingestion batches" subtitle="Uploaded via file or API">
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>File</th>
                  <th>Records</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map((b) => (
                  <tr key={b.id}>
                    <td className="cbz-mono">{b.id}</td>
                    <td className="cbz-mono cbz-muted">{b.fileName}</td>
                    <td>{b.recordsProcessed}</td>
                    <td>
                      <span className={`cbz-badge cbz-badge--ingest-${b.validationStatus.toLowerCase()}`}>
                        {b.validationStatus}
                      </span>
                    </td>
                    <td>{fmtDateTime(b.uploadedAt)}</td>
                  </tr>
                ))}
                {recentBatches.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title="No batches ingested for this scope yet." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Your recent submissions" subtitle="Records you contributed">
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Dataset</th>
                  <th className="cbz-num">tCO2e</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentDrafts.map((r) => (
                  <tr key={r.id}>
                    <td className="cbz-mono">{r.id}</td>
                    <td>
                      <div>{r.datasetType}</div>
                      <div className="cbz-muted">{r.site} · {r.period}</div>
                    </td>
                    <td className="cbz-num">{fmtT(r.emissionsTco2e, 3)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
                {recentDrafts.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState title="You haven't submitted anything yet." hint="Try the manual form above." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

interface ParsedRow {
  rowNumber: number;
  entity?: EntityCode;
  site?: string;
  period?: string;
  scope?: Scope;
  datasetType?: string;
  activity?: number;
  unit?: string;
  factor?: number;
  dq?: number;
  error?: string;
}

const VALID_ENTITIES: EntityCode[] = ['CBZBANK', 'CBZCAP', 'DATVEST', 'CBZAGRO', 'CBZPROP', 'CBZINS', 'CBZLIFE', 'CBZRISK', 'CBZRED'];
const VALID_SCOPES: Scope[] = ['scope1', 'scope2', 'scope3'];

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV needs a header row and at least one data row.');
  }
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const required = ['entity_code', 'site', 'period', 'scope', 'dataset_type', 'activity_data', 'unit', 'emission_factor', 'data_quality'];
  for (const col of required) {
    if (!header.includes(col)) {
      throw new Error(`Missing required column: ${col}`);
    }
  }
  const idx = (col: string) => header.indexOf(col);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = line.split(',').map((c) => c.trim());
    const row: ParsedRow = { rowNumber: i };
    const entity = cells[idx('entity_code')] as EntityCode;
    const scope = cells[idx('scope')] as Scope;
    const activity = Number.parseFloat(cells[idx('activity_data')]);
    const factor = Number.parseFloat(cells[idx('emission_factor')]);
    const dq = Number.parseInt(cells[idx('data_quality')], 10);
    row.entity = entity;
    row.site = cells[idx('site')];
    row.period = cells[idx('period')];
    row.scope = scope;
    row.datasetType = cells[idx('dataset_type')];
    row.unit = cells[idx('unit')];
    row.activity = activity;
    row.factor = factor;
    row.dq = dq;
    if (!VALID_ENTITIES.includes(entity)) row.error = `Unknown entity_code ${entity}`;
    else if (!VALID_SCOPES.includes(scope)) row.error = `Unknown scope ${scope}`;
    else if (!Number.isFinite(activity) || activity <= 0) row.error = 'Invalid activity_data';
    else if (!Number.isFinite(factor) || factor <= 0) row.error = 'Invalid emission_factor';
    else if (!Number.isFinite(dq) || dq < 1 || dq > 5) row.error = 'Invalid data_quality (1-5)';
    rows.push(row);
  }
  return rows;
}
