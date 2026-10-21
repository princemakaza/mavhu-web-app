// Disclosure centre: framework mapping & reporting (F6-F9, F11-F13), distribution of locked
// versions only (F44) and exports (F45).
import { useEffect, useMemo, useState } from 'react';
import { apiPublishDisclosure, downloadDisclosure, fetchDisclosure, fetchDisclosures } from '../../../model/cbz/cbz_api';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import { FRAMEWORKS, FRAMEWORK_LABELS, LOCAL_FRAMEWORKS, METRICS, formatMetric, periodIn, type Framework } from '../../../model/cbz/metrics';
import type { DisclosureRow, DisclosureVersion, EntityCode } from '../../../model/cbz/types';
import { useRegisters } from '../../../model/cbz/useRegister';
import { EmptyState, MethodNote, Panel, ProgressBar, RagChip, StatCard, fmtDateTime } from '../components/primitives';
import { SimpleModal } from '../components/SimpleModal';

const REGISTER_KEYS = ['resource-use', 'community-investment', 'suppliers', 'targets', 'material-topics'];

export function DisclosuresTab({ scope }: { scope: EntityCode }) {
  const { state, bank, can } = useCbzData();
  const registers = useRegisters(REGISTER_KEYS);
  const [framework, setFramework] = useState<Framework>('IFRS S2');
  const years = useMemo(() => [...new Set(state.emissions.map((e) => e.period.slice(0, 4)))].filter((y) => /^\d{4}$/.test(y)).sort().reverse(), [state.emissions]);
  const [period, setPeriod] = useState<string>('');
  const [versions, setVersions] = useState<DisclosureVersion[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  const selectedPeriod = period || years[1] || years[0] || String(new Date().getFullYear());
  const periodOptions = useMemo(() => years.flatMap((y) => [y, `${y}-Q1`, `${y}-Q2`, `${y}-Q3`, `${y}-Q4`]), [years]);

  const loadVersions = () => fetchDisclosures().then(setVersions).catch(() => setVersions([]));
  useEffect(() => {
    void loadVersions();
  }, []);

  const rows: DisclosureRow[] = useMemo(
    () =>
      METRICS.filter((m) => m.refs[framework]).map((m) => {
        const ctx = { state, scope, period: selectedPeriod, registers };
        const value = m.compute(ctx);
        const clean = typeof value === 'number' && !Number.isFinite(value) ? null : value;
        return {
          code: m.code,
          label: m.label,
          value: typeof clean === 'number' ? Math.round(clean * 10000) / 10000 : clean,
          unit: m.unit,
          reference: m.refs[framework] as string,
          pillar: m.pillar,
          basis: m.basis,
          sources: m.sources?.(ctx) ?? 0,
        };
      }),
    [framework, state, scope, selectedPeriod, registers],
  );

  const reported = rows.filter((r) => r.value !== null && r.value !== '').length;
  const excluded = state.emissions.filter((e) => (scope === 'GROUP' || e.entityCode === scope) && periodIn(e.period, selectedPeriod) && !['approved', 'locked'].includes(e.status)).length;

  async function publish(title: string, notes: string) {
    const saved = await apiPublishDisclosure({ framework, period: selectedPeriod, title, notes, rows });
    setMessage({ kind: 'success', text: `Published ${framework} ${selectedPeriod} version ${saved.version}. It is now locked; republishing creates version ${saved.version + 1}.` });
    await loadVersions();
  }

  async function print(v: DisclosureVersion) {
    const full = await fetchDisclosure(v.id);
    const w = window.open('', '_blank');
    if (!w || !full.snapshot) return;
    const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(full.title)}</title>
<style>body{font-family:Inter,Arial,sans-serif;color:#0f2b3a;margin:32px}h1{color:#0B4F6C;margin:0 0 4px}p{color:#475467;margin:4px 0}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th{background:#0B4F6C;color:#fff;text-align:left;padding:6px}td{border-bottom:1px solid #d8e2e6;padding:6px;vertical-align:top}
.foot{margin-top:24px;font-size:11px;color:#667085}</style></head><body>
<h1>${esc(full.title)}</h1><p>${esc(full.framework)} · ${esc(full.period)} · version ${full.version} · published ${esc(fmtDateTime(full.publishedAt))} by ${esc(full.publishedBy)}</p>
<p>Basis: ${esc(full.snapshot.basis)} · completeness ${(full.snapshot.completeness * 100).toFixed(0)}%</p>
<table><tr><th>Reference</th><th>Disclosure</th><th>Value</th><th>Unit</th><th>Basis</th></tr>
${full.snapshot.rows.map((r) => `<tr><td>${esc(r.reference)}</td><td>${esc(r.label)}</td><td>${esc(r.value ?? 'Not available')}</td><td>${esc(r.unit)}</td><td>${esc(r.basis)}</td></tr>`).join('')}</table>
<p class="foot">Integrity: SHA-256 ${esc(full.hash)} · ${full.intact ? 'verified intact' : 'INTEGRITY CHECK FAILED'} · MAvHU ESG Platform</p>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Framework" value={framework} hint={FRAMEWORK_LABELS[framework]} />
        <StatCard label="Completeness" value={`${Math.round((reported / Math.max(1, rows.length)) * 100)}%`} hint={`${reported} of ${rows.length} items have data`} intent={reported === rows.length ? 'positive' : 'warning'} />
        <StatCard label="Unapproved records excluded" value={String(excluded)} hint="Only approved & locked data is disclosed" intent={excluded ? 'warning' : 'neutral'} />
        <StatCard label="Published versions" value={String(versions.filter((v) => v.framework === framework).length)} hint="Locked, hashed, immutable" />
      </div>

      <Panel
        title="Disclosure index"
        subtitle="Every metric is tagged once against each framework, so one approved data point feeds every disclosure."
        action={
          <div className="cbz-toolbar">
            <select value={framework} onChange={(e) => setFramework(e.target.value as Framework)} aria-label="Framework">
              {FRAMEWORKS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select value={selectedPeriod} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
              {periodOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {can('publish') && (
              <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setPublishing(true)}>
                Publish locked version
              </button>
            )}
          </div>
        }
        padded={false}
      >
        {message && <p className={`cbz-alert cbz-alert--${message.kind}`}>{message.text}</p>}
        {LOCAL_FRAMEWORKS.includes(framework) && (
          <p className="cbz-alert cbz-alert--info">Local regulatory mapping: references name the regulator's template section and need validating against the current template before submission.</p>
        )}
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>{framework} reference</th>
                <th>Disclosure item</th>
                <th className="cbz-num">Value</th>
                <th>Status</th>
                <th>Also feeds</th>
                <th>Basis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const metric = METRICS.find((m) => m.code === r.code)!;
                const also = FRAMEWORKS.filter((f) => f !== framework && metric.refs[f]);
                return (
                  <tr key={r.code}>
                    <td className="cbz-mono">{r.reference}</td>
                    <td>
                      {r.label}
                      <div className="cbz-muted">{r.pillar}</div>
                    </td>
                    <td className="cbz-num">
                      <strong>{formatMetric(r.value, r.unit)}</strong> <span className="cbz-muted">{r.unit !== 'narrative' && typeof r.value === 'number' ? r.unit : ''}</span>
                    </td>
                    <td>{r.value === null || r.value === '' ? <RagChip status="grey" label="Not available" /> : <RagChip status="green" label={`Reported${r.sources ? ` · ${r.sources} src` : ''}`} />}</td>
                    <td className="cbz-muted">{framework === 'TCFD' && metric.refs['IFRS S2'] ? <strong>IFRS S2 {metric.refs['IFRS S2']}</strong> : also.join(', ')}</td>
                    <td className="cbz-muted">{r.basis}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <MethodNote>
          {framework === 'TCFD' ? 'TCFD-to-IFRS S2 index: each TCFD recommendation is shown with the IFRS S2 paragraph that now carries it. ' : ''}
          Scope: {scope === 'GROUP' ? `${bank?.name ?? 'Group'} consolidated` : scope}. Period {selectedPeriod}. Draft and in-review records are excluded until approved.
        </MethodNote>
      </Panel>

      <Panel title="Published versions" subtitle="Only locked versions are distributed. Each is hashed; any change to a stored version fails the integrity check (F44, F45)." padded={false}>
        {versions.length === 0 ? (
          <EmptyState title="Nothing published yet." hint={can('publish') ? 'Build an index above and publish it.' : 'An approver or bank admin publishes disclosures.'} />
        ) : (
          <div className="cbz-table-wrap">
            <table className="cbz-table">
              <thead>
                <tr>
                  <th>Disclosure</th>
                  <th>Framework</th>
                  <th>Period</th>
                  <th>Version</th>
                  <th>Published</th>
                  <th>SHA-256</th>
                  <th>Export</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>{v.title}</td>
                    <td>{v.framework}</td>
                    <td>{v.period}</td>
                    <td>v{v.version}</td>
                    <td>
                      <div>{fmtDateTime(v.publishedAt)}</div>
                      <div className="cbz-muted">{v.publishedBy}</div>
                    </td>
                    <td className="cbz-mono cbz-muted" title={v.hash}>
                      {v.hash.slice(0, 12)}…
                    </td>
                    <td>
                      <div className="cbz-toolbar">
                        {(['xlsx', 'csv', 'doc', 'json'] as const).map((f) => (
                          <button key={f} type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => downloadDisclosure(v, f)}>
                            {f === 'xlsx' ? 'Excel' : f === 'doc' ? 'Word' : f.toUpperCase()}
                          </button>
                        ))}
                        <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => print(v)}>
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <MethodNote>Power BI: connect to the CSV or JSON export. XBRL tagging is not yet available.</MethodNote>
      </Panel>

      {publishing && (
        <SimpleModal
          title={`Publish ${framework} ${selectedPeriod}`}
          subtitle={`${reported} of ${rows.length} items have data. Once published this version cannot be changed.`}
          submitLabel="Publish and lock"
          fields={[
            { key: 'title', label: 'Title', initial: `${bank?.name ?? ''} ${framework} disclosure ${selectedPeriod}`.trim(), required: true },
            { key: 'notes', label: 'Notes for readers (optional)', textarea: true },
          ]}
          onClose={() => setPublishing(false)}
          onSubmit={async (v) => {
            await publish(v.title, v.notes);
            setPublishing(false);
          }}
        />
      )}
    </>
  );
}
