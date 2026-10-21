// Materiality (F24/F12), stakeholders (F23), suppliers (F26) and data ownership (F36).
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import type { EntityCode, RegisterItem } from '../../../model/cbz/types';
import { MethodNote, Panel, RagChip, StatCard, fmtUsd } from '../components/primitives';
import { RegisterView } from '../components/RegisterView';

const PILLAR_CLASS: Record<string, string> = { Environmental: 'env', Social: 'soc', Governance: 'gov', Economic: 'eco' };

function MaterialityMatrix({ topics }: { topics: RegisterItem[] }) {
  const size = 320;
  const pad = 36;
  const pos = (score: number) => pad + ((score - 1) / 4) * (size - pad * 2);
  return (
    <Panel title="Double materiality matrix" subtitle="Impact materiality (vertical) against financial materiality (horizontal). Top-right topics are disclosed.">
      <div className="cbz-matrix">
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Materiality matrix">
          {/* Disclosure zone: both scores ≥ 3.5 (top right). */}
          <rect x={pos(3.5)} y={pad} width={size - pad - pos(3.5)} height={size - pos(3.5) - pad} className="cbz-matrix__zone" />
          {[1, 2, 3, 4, 5].map((n) => (
            <g key={n}>
              <line x1={pos(n)} y1={pad} x2={pos(n)} y2={size - pad} className="cbz-matrix__grid" />
              <line x1={pad} y1={size - pos(n)} x2={size - pad} y2={size - pos(n)} className="cbz-matrix__grid" />
              <text x={pos(n)} y={size - pad + 16} className="cbz-matrix__tick">
                {n}
              </text>
              <text x={pad - 14} y={size - pos(n) + 4} className="cbz-matrix__tick">
                {n}
              </text>
            </g>
          ))}
          <text x={size / 2} y={size - 4} className="cbz-matrix__axis">
            Financial materiality →
          </text>
          <text x={10} y={size / 2} className="cbz-matrix__axis" transform={`rotate(-90 10 ${size / 2})`}>
            Impact materiality →
          </text>
          {topics.map((t, i) => {
            const x = pos(Number(t.data.financialScore)) + ((i % 3) - 1) * 7;
            const y = size - pos(Number(t.data.impactScore)) + ((i % 2) * 2 - 1) * 5;
            return (
              <g key={t.id}>
                <circle cx={x} cy={y} r={9} className={`cbz-matrix__dot cbz-matrix__dot--${PILLAR_CLASS[String(t.data.pillar)] ?? 'env'}`} />
                <text x={x} y={y + 3.5} className="cbz-matrix__num">
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
        <ol className="cbz-matrix__legend">
          {topics.map((t) => (
            <li key={t.id}>
              <span className={`cbz-dot cbz-dot--${PILLAR_CLASS[String(t.data.pillar)] ?? 'env'}`} /> {String(t.data.topic)}{' '}
              <span className="cbz-muted">
                (I{String(t.data.impactScore)} · F{String(t.data.financialScore)}
                {t.data.tnfdLeap ? ` · TNFD ${t.data.tnfdLeap}` : ''})
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

export function MaterialityTab() {
  return (
    <RegisterView
      register="material-topics"
      title="Material topics"
      subtitle="Scored by stakeholders on impact and financial materiality; nature topics carry their TNFD LEAP phase (F24, F12)."
      header={(items) => <MaterialityMatrix topics={items} />}
      columns={[
        { key: 'topic', label: 'Topic' },
        { key: 'pillar', label: 'Pillar' },
        { key: 'impactScore', label: 'Impact', numeric: true },
        { key: 'financialScore', label: 'Financial', numeric: true },
        { key: 'frameworkRef', label: 'Framework' },
        { key: 'tnfdLeap', label: 'TNFD LEAP' },
        { key: 'owner', label: 'Owner' },
      ]}
    />
  );
}

export function StakeholdersTab() {
  return (
    <>
      <RegisterView
        register="stakeholders"
        title="Stakeholder register"
        subtitle="Who matters, how much influence and interest they have, and who owns the relationship (F23)."
        columns={[
          { key: 'name', label: 'Stakeholder' },
          { key: 'group', label: 'Group' },
          { key: 'influence', label: 'Influence', numeric: true },
          { key: 'interest', label: 'Interest', numeric: true },
          {
            key: 'priority',
            label: 'Approach',
            render: (i) => {
              const hi = (k: string) => Number(i.data[k]) >= 4;
              return hi('influence') && hi('interest') ? <RagChip status="red" label="Manage closely" /> : hi('influence') ? <RagChip status="amber" label="Keep satisfied" /> : hi('interest') ? <RagChip status="amber" label="Keep informed" /> : <RagChip status="grey" label="Monitor" />;
            },
          },
          { key: 'owner', label: 'Owner' },
        ]}
      />
      <RegisterView
        register="engagements"
        title="Engagement log"
        subtitle="Meetings, forums and surveys with their outcome and follow-up."
        columns={[
          { key: 'date', label: 'Date' },
          { key: 'stakeholder', label: 'Stakeholder' },
          { key: 'channel', label: 'Channel' },
          { key: 'topics', label: 'Topics' },
          { key: 'outcome', label: 'Outcome' },
          { key: 'followUp', label: 'Follow-up' },
        ]}
      />
    </>
  );
}

const supplierScore = (i: RegisterItem) => (Number(i.data.environmentalRisk) + Number(i.data.socialRisk) + Number(i.data.governanceRisk)) / 3;
const supplierBand = (i: RegisterItem): { rag: 'red' | 'amber' | 'green'; label: string } => {
  const worst = Math.max(Number(i.data.environmentalRisk), Number(i.data.socialRisk), Number(i.data.governanceRisk));
  const s = supplierScore(i);
  return worst >= 4 || s >= 3.5 ? { rag: 'red', label: 'High' } : s >= 2.5 ? { rag: 'amber', label: 'Medium' } : { rag: 'green', label: 'Low' };
};

export function SuppliersTab() {
  return (
    <RegisterView
      register="suppliers"
      title="Supplier & value-chain ESG risk"
      subtitle="Risk score = average of environmental, social and governance ratings; any dimension rated 4+ makes the supplier high-risk (F26)."
      header={(items) => {
        const spend = items.reduce((s, i) => s + Number(i.data.spendUsd ?? 0), 0);
        const local = items.filter((i) => i.data.localSupplier === true).reduce((s, i) => s + Number(i.data.spendUsd ?? 0), 0);
        return (
          <div className="cbz-grid cbz-grid--stats">
            <StatCard label="Suppliers" value={String(items.length)} hint={`${fmtUsd(spend)} annual spend`} />
            <StatCard label="ESG screened" value={items.length ? `${Math.round((items.filter((i) => i.data.esgScreened === true).length / items.length) * 100)}%` : '—'} hint="GRI 308-1 / 414-1" intent="positive" />
            <StatCard label="High-risk suppliers" value={String(items.filter((i) => supplierBand(i).rag === 'red').length)} intent="warning" />
            <StatCard label="Local procurement" value={spend ? `${Math.round((local / spend) * 100)}%` : '—'} hint="Share of spend" />
          </div>
        );
      }}
      columns={[
        { key: 'name', label: 'Supplier' },
        { key: 'category', label: 'Category' },
        { key: 'spendUsd', label: 'Spend', render: (i) => fmtUsd(Number(i.data.spendUsd)), numeric: true },
        { key: 'dims', label: 'E · S · G', render: (i) => `${i.data.environmentalRisk} · ${i.data.socialRisk} · ${i.data.governanceRisk}` },
        { key: 'score', label: 'Risk', render: (i) => <RagChip status={supplierBand(i).rag} label={`${supplierBand(i).label} (${supplierScore(i).toFixed(1)})`} /> },
        { key: 'esgScreened', label: 'Screened', render: (i) => (i.data.esgScreened ? 'Yes' : 'No') },
        { key: 'lastAssessment', label: 'Last assessed' },
      ]}
    />
  );
}

export function DataOwnershipTab({ scope }: { scope: EntityCode }) {
  const { state } = useCbzData();
  return (
    <>
      <RegisterView
        register="data-owners"
        title="Data ownership"
        subtitle="A named owner and back-up per dataset per subsidiary, and where the data comes from (F36)."
        scope={scope}
        defaults={{ frequency: 'Monthly' }}
        columns={[
          { key: 'dataset', label: 'Dataset' },
          { key: 'function', label: 'Function' },
          { key: 'owner', label: 'Owner' },
          { key: 'backupOwner', label: 'Back-up' },
          { key: 'sourceSystem', label: 'Source system' },
          { key: 'frequency', label: 'Frequency' },
        ]}
      />
      <MethodNote>
        Owners are accountable for the datasets they hold; the Workflow tab shows who submitted and who approved each record ({state.emissions.length} records in this bank).
      </MethodNote>
    </>
  );
}
