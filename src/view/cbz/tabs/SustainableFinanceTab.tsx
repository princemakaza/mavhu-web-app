// Sustainable finance taxonomy tagging (F22), portfolio tracking (F33) and ESG-linked products (F34).
import { useMemo, useState } from 'react';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import type { Counterparty, EntityCode } from '../../../model/cbz/types';
import { ASSET_CLASS_LABEL } from '../../../model/cbz/types';
import { BarChart } from '../components/charts';
import { EmptyState, Panel, ProgressBar, RagChip, StatCard, fmtPct, fmtUsd } from '../components/primitives';
import { RegisterView } from '../components/RegisterView';
import { SimpleModal } from '../components/SimpleModal';

const TAXONOMIES = ['AfDB', 'ICMA GBP', 'ICMA SBP', 'ICMA SLBP', 'Zimbabwe Green Taxonomy'];
const STATUSES = ['Aligned', 'Eligible', 'Under review', 'Not eligible'];
const CATEGORIES = [
  'Renewable energy',
  'Energy efficiency',
  'Green buildings',
  'Clean transportation',
  'Climate-smart agriculture',
  'Sustainable water management',
  'Access to clean energy',
  'Affordable housing',
  'SME finance & employment',
  'Pollution prevention',
];
const RAG: Record<string, 'green' | 'amber' | 'grey' | 'red'> = { Aligned: 'green', Eligible: 'amber', 'Under review': 'grey', 'Not eligible': 'red' };

export function SustainableFinanceTab({ scope }: { scope: EntityCode }) {
  const { state, can, tagCounterparty } = useCbzData();
  const [tagging, setTagging] = useState<Counterparty | null>(null);
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const out = new Map<string, number>();
    for (const p of state.financedPositions) out.set(p.counterpartyId, (out.get(p.counterpartyId) ?? 0) + p.outstandingAmountUsd);
    return state.counterparties
      .filter((c) => scope === 'GROUP' || c.subsidiary === scope)
      .map((c) => ({ cp: c, outstanding: out.get(c.id) ?? 0 }))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [state.counterparties, state.financedPositions, scope]);

  const total = rows.reduce((s, r) => s + r.outstanding, 0);
  const by = (status: string) => rows.filter((r) => r.cp.taxonomyStatus === status).reduce((s, r) => s + r.outstanding, 0);
  const tagged = rows.filter((r) => r.cp.taxonomy);
  const byTaxonomy = TAXONOMIES.map((t) => ({ label: t, value: +(tagged.filter((r) => r.cp.taxonomy === t).reduce((s, r) => s + r.outstanding, 0) / 1e6).toFixed(2) })).filter((d) => d.value > 0);
  const visible = showAll ? rows : tagged;

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Green asset ratio" value={total ? fmtPct(by('Aligned') / total) : '—'} hint="Aligned ÷ total outstanding" intent="positive" />
        <StatCard label="Aligned" value={fmtUsd(by('Aligned'))} hint={`${rows.filter((r) => r.cp.taxonomyStatus === 'Aligned').length} instruments`} intent="positive" />
        <StatCard label="Eligible, not yet aligned" value={fmtUsd(by('Eligible') + by('Under review'))} hint="Pipeline to verify" intent="warning" />
        <StatCard label="Tagged instruments" value={`${tagged.length} / ${rows.length}`} hint="AfDB · ICMA · local taxonomy" />
      </div>

      <Panel title="Aligned & eligible exposure by taxonomy" subtitle="US$ millions outstanding">
        {byTaxonomy.length ? <BarChart data={byTaxonomy} unit="M" ariaLabel="Exposure by taxonomy" /> : <EmptyState title="No instruments tagged yet." />}
      </Panel>

      <Panel
        title="Taxonomy tagging"
        subtitle="Tag an instrument against AfDB, ICMA or local taxonomy criteria; status moves from Under review → Eligible → Aligned once evidenced (F22, F33)."
        action={
          <label className="cbz-check">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show untagged instruments
          </label>
        }
        padded={false}
      >
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Instrument / borrower</th>
                <th>Asset class</th>
                <th>Sector</th>
                <th className="cbz-num">Outstanding</th>
                <th>Taxonomy</th>
                <th>Category</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ cp, outstanding }) => (
                <tr key={cp.id}>
                  <td>
                    {cp.name}
                    {cp.customerId && <span className="cbz-chip cbz-chip--sm cbz-chip--mrv">MRV</span>}
                  </td>
                  <td className="cbz-muted">{ASSET_CLASS_LABEL[cp.assetClass]}</td>
                  <td>{cp.sector}</td>
                  <td className="cbz-num">{fmtUsd(outstanding)}</td>
                  <td>{cp.taxonomy ?? <span className="cbz-muted">—</span>}</td>
                  <td>{cp.taxonomyCategory ?? <span className="cbz-muted">—</span>}</td>
                  <td>{cp.taxonomyStatus ? <RagChip status={RAG[cp.taxonomyStatus] ?? 'grey'} label={cp.taxonomyStatus} /> : <span className="cbz-muted">Untagged</span>}</td>
                  <td>
                    {can('tag-taxonomy') && (
                      <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => setTagging(cp)}>
                        {cp.taxonomy ? 'Edit tag' : 'Tag'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="No tagged instruments." hint="Tick “Show untagged instruments” to tag one." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <RegisterView
        register="esg-products"
        title="ESG-linked products"
        subtitle="Sustainability-linked loans, green bonds and deposits with their KPI performance and margin ratchet (F34)."
        scope={scope}
        columns={[
          { key: 'product', label: 'Product' },
          { key: 'type', label: 'Type' },
          { key: 'amountUsd', label: 'Amount', render: (i) => fmtUsd(Number(i.data.amountUsd)), numeric: true },
          { key: 'kpi', label: 'KPI' },
          {
            key: 'perf',
            label: 'KPI performance',
            render: (i) => {
              const target = Number(i.data.kpiTarget);
              const actual = Number(i.data.kpiActual);
              if (!target || !Number.isFinite(actual)) return <span className="cbz-muted">No reading</span>;
              return <ProgressBar value={actual / target} tone={actual >= target ? 'green' : 'amber'} label={`${actual.toLocaleString('en-GB')} / ${target.toLocaleString('en-GB')}`} />;
            },
          },
          { key: 'marginRatchetBps', label: 'Ratchet (bps)', numeric: true },
          { key: 'status', label: 'Status', render: (i) => <RagChip status={i.data.status === 'On track' ? 'green' : i.data.status === 'Off track' ? 'red' : 'grey'} label={String(i.data.status)} /> },
        ]}
      />

      {tagging && (
        <SimpleModal
          title={`Taxonomy tag: ${tagging.name}`}
          subtitle="Choose “(remove tag)” to clear it. The change and the previous tag are kept in the audit trail."
          submitLabel="Save tag"
          fields={[
            { key: 'taxonomy', label: 'Taxonomy', options: ['(remove tag)', ...TAXONOMIES], initial: tagging.taxonomy ?? TAXONOMIES[1], required: true },
            { key: 'taxonomyCategory', label: 'Eligible category', options: CATEGORIES, initial: tagging.taxonomyCategory ?? CATEGORIES[0], required: true },
            { key: 'taxonomyStatus', label: 'Status', options: STATUSES, initial: tagging.taxonomyStatus ?? 'Under review', required: true },
          ]}
          onClose={() => setTagging(null)}
          onSubmit={async (v) => {
            const remove = v.taxonomy === '(remove tag)';
            await tagCounterparty(tagging.id, { taxonomy: remove ? null : v.taxonomy, taxonomyCategory: remove ? null : v.taxonomyCategory, taxonomyStatus: remove ? null : v.taxonomyStatus });
            setTagging(null);
          }}
        />
      )}
    </>
  );
}
