import { useEffect, useMemo, useState } from 'react';
import type { AgriApi, AgriMe, CropCycle, EmissionFactor, Estate, FarmEmission, FieldVisit, SatellitePoint } from '../../model/agri/agriApi';
import { LineChart } from '../cbz/components/charts';
import { EmptyState, MethodNote, Panel, RagChip, StatCard, fmtT } from '../cbz/components/primitives';
import { SimpleModal } from '../cbz/components/SimpleModal';
import { ThemeToggle } from '../cbz/components/ThemeToggle';

const TABS = [
  { key: 'overview', label: 'Farm overview', description: 'Estates, carbon stock and who finances you' },
  { key: 'satellite', label: 'Satellite MRV', description: 'Monthly NDVI and carbon stock per estate' },
  { key: 'cycles', label: 'Crop cycles', description: 'Seasons per estate' },
  { key: 'emissions', label: 'Emissions accounting', description: 'Farm activity data → tCO2e, with approval' },
  { key: 'visits', label: 'Field verification', description: 'Ground-truth visits confirming the satellite view' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

interface Data {
  me: AgriMe;
  estates: Estate[];
  satellite: SatellitePoint[];
  cycles: CropCycle[];
  factors: EmissionFactor[];
  emissions: FarmEmission[];
  visits: FieldVisit[];
}

/** The Agri MRV portal for one farm. `viewer` = MAvHU staff opening it read-only. */
export function AgriDashboard({ api, onSignOut, signOutLabel = 'Sign out' }: { api: AgriApi; onSignOut: () => void; signOutLabel?: string }) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [me, estates, satellite, cycles, factors, emissions, visits] = await Promise.all([
        api.me(),
        api.estates(),
        api.satellite(),
        api.cropCycles(),
        api.factors(),
        api.emissions(),
        api.visits(),
      ]);
      setData({ me, estates, satellite, cycles, factors, emissions, visits });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  useEffect(() => {
    void load();
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = TABS.find((t) => t.key === tab)!;
  const roleLabel = data?.me.viewer ? 'MAvHU (read-only)' : data?.me.roles.map((r) => r.replace('ESG_', '').toLowerCase()).join(', ');

  return (
    <div className="cbz-app cbz-app--agri">
      <aside className="cbz-nav">
        <div className="cbz-nav__brand">
          <div className="cbz-nav__mark cbz-nav__mark--mavhu">MRV</div>
          <div>
            <div className="cbz-nav__title">{data?.me.customer.name ?? 'Loading…'}</div>
            <div className="cbz-nav__subtitle">Agri MRV · MAvHU</div>
          </div>
        </div>
        <nav aria-label="Agri MRV sections">
          <div className="cbz-nav__group">
            {TABS.map((t) => (
              <button key={t.key} type="button" className={`cbz-nav__tab ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)} title={t.description}>
                <span className="cbz-nav__tab-label">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="cbz-nav__foot">
          {data && (
            <div className="cbz-nav__user">
              <div className="cbz-avatar">{data.me.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div>
              <div>
                <div className="cbz-nav__user-name">{data.me.name}</div>
                <div className="cbz-nav__user-role">{roleLabel}</div>
              </div>
            </div>
          )}
          <button type="button" className="cbz-btn cbz-btn--ghost cbz-btn--block" onClick={onSignOut}>
            {signOutLabel}
          </button>
        </div>
      </aside>
      <main className="cbz-main">
        {data?.me.viewer && <div className="cbz-alert cbz-alert--info cbz-admin-banner">Viewing {data.me.customer.name} read-only as MAvHU staff. The farm's own users enter and approve data.</div>}
        {error && <div className="cbz-alert cbz-alert--danger">{error}</div>}
        <header className="cbz-topbar">
          <div>
            <div className="cbz-topbar__eyebrow">{active.description}</div>
            <h1 className="cbz-topbar__title">{active.label}</h1>
          </div>
          <div className="cbz-topbar__actions">
            <span className="cbz-pill cbz-pill--frame">Synthetic demo data</span>
            <ThemeToggle />
          </div>
        </header>
        <div className="cbz-content" key={tab}>
          {!data ? (
            <p className="cbz-muted">Loading…</p>
          ) : tab === 'overview' ? (
            <Overview data={data} />
          ) : tab === 'satellite' ? (
            <Satellite data={data} />
          ) : tab === 'cycles' ? (
            <Cycles data={data} api={api} reload={load} />
          ) : tab === 'emissions' ? (
            <Emissions data={data} api={api} reload={load} />
          ) : (
            <Visits data={data} api={api} reload={load} />
          )}
        </div>
      </main>
    </div>
  );
}

function Overview({ data }: { data: Data }) {
  const ha = data.estates.reduce((s, e) => s + e.hectares, 0);
  const stock = data.estates.reduce((s, e) => s + (e.carbonStockTco2 ?? 0), 0);
  const change = data.estates.reduce((s, e) => s + (e.carbonChangeTco2 ?? 0), 0);
  const pending = data.emissions.filter((e) => !e.approved).length;
  const approvedT = data.emissions.filter((e) => e.approved).reduce((s, e) => s + e.tonCo2e, 0);
  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Land monitored" value={ha.toLocaleString('en-GB')} unit="ha" hint={`${data.estates.length} estate(s)`} />
        <StatCard label="Carbon stock" value={fmtT(stock, 0)} unit="tCO2" hint={`${change >= 0 ? '+' : ''}${fmtT(change, 0)} vs a year ago`} intent={change >= 0 ? 'positive' : 'warning'} />
        <StatCard label="Approved farm emissions" value={fmtT(approvedT, 1)} unit="tCO2e" />
        <StatCard label="Awaiting approval" value={String(pending)} intent={pending ? 'warning' : 'neutral'} />
      </div>
      <Panel title="Estates" subtitle="Latest Sentinel-2 pass per estate, against the same month last year" padded={false}>
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Estate</th>
                <th className="cbz-num">Hectares</th>
                <th>Latest pass</th>
                <th>NDVI (vs year ago)</th>
                <th className="cbz-num">Carbon stock</th>
                <th>Last field visit</th>
              </tr>
            </thead>
            <tbody>
              {data.estates.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td className="cbz-num">{e.hectares.toLocaleString('en-GB')}</td>
                  <td className="cbz-mono">{e.latestPass?.slice(0, 10) ?? '—'}</td>
                  <td>
                    {e.ndvi?.toFixed(2) ?? '—'} <span className="cbz-muted">({e.ndviYearAgo?.toFixed(2) ?? '—'})</span>
                  </td>
                  <td className="cbz-num">{e.carbonStockTco2 ? `${fmtT(e.carbonStockTco2, 0)} t` : '—'}</td>
                  <td>{e.lastVisit?.slice(0, 10) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Financed by" subtitle="Your verified MRV data lifts these banks' PCAF data-quality score on your loans, which supports greener, cheaper credit.">
        {data.me.financedBy.length ? (
          <ul className="cbz-attention">
            {data.me.financedBy.map((b) => (
              <li key={b.bank}>
                <strong>{b.bank}</strong>
                <span className="cbz-muted">Reference {b.reference}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Not linked to a bank yet." />
        )}
      </Panel>
    </>
  );
}

function Satellite({ data }: { data: Data }) {
  const [estateId, setEstateId] = useState<number>(data.estates[0]?.id ?? 0);
  const points = useMemo(() => data.satellite.filter((p) => p.estateId === estateId), [data.satellite, estateId]);
  const labels = points.map((p) => p.date.slice(0, 7));
  const recent = points.slice(-12);
  const prior = points.slice(-24, -12);
  const avg = (xs: SatellitePoint[]) => (xs.length ? xs.reduce((s, p) => s + p.ndviMax, 0) / xs.length : null);
  const a = avg(recent);
  const b = avg(prior);
  const stress = a !== null && b !== null && a < b - 0.03;
  return (
    <>
      <div className="cbz-toolbar" style={{ marginBottom: 12 }}>
        <label className="cbz-field cbz-field--inline">
          <span>Estate</span>
          <select value={estateId} onChange={(e) => setEstateId(Number(e.target.value))}>
            {data.estates.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        {a !== null && b !== null && <RagChip status={stress ? 'red' : 'green'} label={stress ? `Vegetation stress: 12-month NDVI ${a.toFixed(2)} vs ${b.toFixed(2)}` : `Stable: 12-month NDVI ${a.toFixed(2)} vs ${b.toFixed(2)}`} />}
      </div>
      {points.length === 0 ? (
        <EmptyState title="No satellite passes for this estate yet." />
      ) : (
        <>
          <Panel title="Vegetation index (NDVI, monthly max)" subtitle="Sentinel-2. Seasonal swings are normal; a lower 12-month average flags drought or degradation (A6).">
            <LineChart historical={points.map((p) => +p.ndviMax.toFixed(3))} labels={labels} unit="" ariaLabel="NDVI series" />
          </Panel>
          <Panel title="Net CO2 stock (biomass + soil organic carbon)" subtitle="Derived from NDVI: AGB = 45.8 × NDVI^2.1; SOC = 82.77 × NDVI − 1.39; × 3.67 × hectares">
            <LineChart historical={points.map((p) => Math.round(p.netCo2Stock))} labels={labels} unit="tCO2" ariaLabel="Carbon stock series" />
          </Panel>
          <MethodNote>These figures feed the financing bank's PCAF calculator directly (A5) and replace sector proxies, moving the loan's data-quality score towards 2.</MethodNote>
        </>
      )}
    </>
  );
}

function Cycles({ data, api, reload }: { data: Data; api: AgriApi; reload: () => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  return (
    <Panel
      title="Crop cycles"
      subtitle="Each season per estate; emissions entries attach to a cycle"
      action={
        data.me.canWrite && (
          <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setAdding(true)}>
            + Add crop cycle
          </button>
        )
      }
      padded={false}
    >
      <div className="cbz-table-wrap">
        <table className="cbz-table">
          <thead>
            <tr>
              <th>Cycle</th>
              <th>Estate</th>
              <th>Start</th>
              <th>End</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {data.cycles.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.estate}</td>
                <td className="cbz-mono">{c.startDate.slice(0, 10)}</td>
                <td className="cbz-mono">{c.endDate.slice(0, 10)}</td>
                <td>{c.recordedBy ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && (
        <SimpleModal
          title="Add a crop cycle"
          submitLabel="Save cycle"
          fields={[
            { key: 'estateId', label: 'Estate', options: data.estates.map((e) => `${e.id}: ${e.name}`), initial: `${data.estates[0]?.id}: ${data.estates[0]?.name}`, required: true },
            { key: 'name', label: 'Name', initial: 'Maize 2026/27', required: true },
            { key: 'startDate', label: 'Start', type: 'date', required: true },
            { key: 'endDate', label: 'End', type: 'date', required: true },
          ]}
          onClose={() => setAdding(false)}
          onSubmit={async (v) => {
            await api.addCropCycle({ estateId: Number(v.estateId.split(':')[0]), name: v.name, startDate: v.startDate, endDate: v.endDate });
            setAdding(false);
            await reload();
          }}
        />
      )}
    </Panel>
  );
}

function Emissions({ data, api, reload }: { data: Data; api: AgriApi; reload: () => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ estateId: data.estates[0]?.id ?? 0, factorId: data.factors[0]?.id ?? 0, quantity: '', scope: 1, startDate: '', endDate: '', note: '' });
  const factor = data.factors.find((f) => f.id === form.factorId);
  const preview = factor && Number(form.quantity) > 0 ? (Number(form.quantity) * factor.factor * factor.gwp) / 1000 : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.addEmission({ estateId: form.estateId, emissionFactorId: form.factorId, quantity: Number(form.quantity), scope: form.scope, startDate: form.startDate, endDate: form.endDate, note: form.note });
      setAdding(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function approve(id: number) {
    setError(null);
    try {
      await api.approveEmission(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve');
    }
  }

  return (
    <Panel
      title="Emissions accounting"
      subtitle="Activity data × emission factor = tCO2e. Contributors submit; an approver who did not submit the entry approves it."
      action={
        data.me.canWrite && (
          <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setAdding(true)}>
            + Record activity
          </button>
        )
      }
      padded={false}
    >
      {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
      <div className="cbz-table-wrap">
        <table className="cbz-table">
          <thead>
            <tr>
              <th>Estate · cycle</th>
              <th>Activity</th>
              <th className="cbz-num">tCO2e</th>
              <th>Scope</th>
              <th>Submitted by</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.emissions.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.estate}
                  <div className="cbz-muted">{e.cropCycle ?? '—'}</div>
                </td>
                <td>
                  {e.quantity.toLocaleString('en-GB')} {e.unit} · {e.factor}
                </td>
                <td className="cbz-num">{fmtT(e.tonCo2e, 2)}</td>
                <td>Scope {e.scope}</td>
                <td>{e.createdBy ?? '—'}</td>
                <td>{e.approved ? <RagChip status="green" label={`Approved · ${e.approvedBy ?? ''}`} /> : <RagChip status="amber" label="Awaiting approval" />}</td>
                <td>
                  {!e.approved && data.me.canApprove && e.createdBy !== data.me.name && (
                    <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--primary" onClick={() => approve(e.id)}>
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && (
        <div className="cbz-modal-backdrop" role="dialog" aria-modal="true" aria-label="Record activity">
          <div className="cbz-modal">
            <header className="cbz-modal__head">
              <div>
                <h3>Record farm activity</h3>
                <p className="cbz-muted">tCO2e = quantity × factor × GWP ÷ 1000</p>
              </div>
              <button type="button" className="cbz-icon-btn" onClick={() => setAdding(false)} aria-label="Close">
                ×
              </button>
            </header>
            <form className="cbz-modal__body" onSubmit={submit}>
              <div className="cbz-grid cbz-grid--form">
                <label className="cbz-field">
                  <span>Estate</span>
                  <select value={form.estateId} onChange={(e) => setForm({ ...form, estateId: Number(e.target.value) })}>
                    {data.estates.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cbz-field">
                  <span>Emission factor</span>
                  <select value={form.factorId} onChange={(e) => setForm({ ...form, factorId: Number(e.target.value) })}>
                    {data.factors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.factor} kg/{f.unit})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cbz-field">
                  <span>Quantity ({factor?.unit ?? 'unit'})</span>
                  <input type="number" min={0} step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                </label>
                <label className="cbz-field">
                  <span>Scope</span>
                  <select value={form.scope} onChange={(e) => setForm({ ...form, scope: Number(e.target.value) })}>
                    <option value={1}>Scope 1</option>
                    <option value={2}>Scope 2</option>
                    <option value={3}>Scope 3</option>
                  </select>
                </label>
                <label className="cbz-field">
                  <span>From</span>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                </label>
                <label className="cbz-field">
                  <span>To</span>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                </label>
                <label className="cbz-field cbz-field--wide">
                  <span>Note</span>
                  <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Tractor diesel, harvest" />
                </label>
              </div>
              <div className="cbz-calc-preview">
                <div>
                  <span className="cbz-muted">Result</span>
                  <strong>{fmtT(preview, 3)} tCO2e</strong>
                </div>
              </div>
              {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
              <footer className="cbz-modal__foot">
                <button type="button" className="cbz-btn cbz-btn--ghost" onClick={() => setAdding(false)}>
                  Cancel
                </button>
                <button type="submit" className="cbz-btn cbz-btn--primary">
                  Submit for approval
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Visits({ data, api, reload }: { data: Data; api: AgriApi; reload: () => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function review(id: number, status: 'Verified' | 'Disputed') {
    setError(null);
    try {
      await api.reviewVisit(id, status);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update');
    }
  }
  return (
    <Panel
      title="Field verification"
      subtitle="Ground-truth visits confirm (or dispute) what the satellite shows (A2)"
      action={
        data.me.canWrite && (
          <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setAdding(true)}>
            + Record visit
          </button>
        )
      }
      padded={false}
    >
      {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
      <div className="cbz-table-wrap">
        <table className="cbz-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Estate</th>
              <th>Officer · method</th>
              <th>Findings</th>
              <th>Satellite confirmed</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.visits.map((v) => (
              <tr key={v.id}>
                <td className="cbz-mono">{v.visitDate.slice(0, 10)}</td>
                <td>{v.estate}</td>
                <td>
                  {v.officer}
                  <div className="cbz-muted">{v.method}</div>
                </td>
                <td>{v.findings}</td>
                <td>{v.ndviConfirmed ? 'Yes' : 'No'}</td>
                <td>
                  <RagChip status={v.status === 'Verified' ? 'green' : v.status === 'Disputed' ? 'red' : 'amber'} label={v.status} />
                </td>
                <td>
                  {data.me.canApprove && v.status === 'Submitted' && (
                    <div className="cbz-toolbar cbz-toolbar--end">
                      <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => review(v.id, 'Disputed')}>
                        Dispute
                      </button>
                      <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--primary" onClick={() => review(v.id, 'Verified')}>
                        Verify
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && (
        <SimpleModal
          title="Record a field visit"
          submitLabel="Save visit"
          fields={[
            { key: 'estateId', label: 'Estate', options: data.estates.map((e) => `${e.id}: ${e.name}`), initial: `${data.estates[0]?.id}: ${data.estates[0]?.name}`, required: true },
            { key: 'visitDate', label: 'Visit date', type: 'date', initial: new Date().toISOString().slice(0, 10), required: true },
            { key: 'officer', label: 'Officer', required: true },
            { key: 'method', label: 'Method', options: ['Ground-truth transect', 'Drone survey', 'Farm visit + photo evidence', 'Soil sampling'], initial: 'Ground-truth transect', required: true },
            { key: 'confirmed', label: 'Satellite view confirmed?', options: ['Yes', 'No'], initial: 'Yes', required: true },
            { key: 'findings', label: 'Findings', textarea: true, required: true },
          ]}
          onClose={() => setAdding(false)}
          onSubmit={async (v) => {
            await api.addVisit({ estateId: Number(v.estateId.split(':')[0]), visitDate: v.visitDate, officer: v.officer, method: v.method, findings: v.findings, ndviConfirmed: v.confirmed === 'Yes' });
            setAdding(false);
            await reload();
          }}
        />
      )}
    </Panel>
  );
}
