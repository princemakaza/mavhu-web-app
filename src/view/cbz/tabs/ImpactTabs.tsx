// Environmental resources (F40) and social impact: community investment (F25) + financial inclusion (F42).
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import type { EntityCode } from '../../../model/cbz/types';
import { EmptyState, MethodNote, Panel, StatCard, fmtPct, fmtUsd } from '../components/primitives';
import { RegisterView } from '../components/RegisterView';

export function EnvironmentTab({ scope }: { scope: EntityCode }) {
  return (
    <RegisterView
      register="resource-use"
      title="Own-footprint resources"
      subtitle="Energy, water and waste per site and period (F40; GRI 302-1, 303-5, 306-3)."
      scope={scope}
      header={(items) => {
        const latest = items.map((i) => String(i.data.period)).sort().pop();
        const rows = items.filter((i) => String(i.data.period) === latest);
        const sum = (k: string) => rows.reduce((s, i) => s + Number(i.data[k] ?? 0), 0);
        const waste = sum('wasteTonnes');
        const recycled = rows.reduce((s, i) => s + Number(i.data.wasteTonnes ?? 0) * Number(i.data.recycledShare ?? 0), 0);
        return (
          <div className="cbz-grid cbz-grid--stats">
            <StatCard label={`Electricity ${latest ?? ''}`} value={sum('electricityKwh').toLocaleString('en-GB')} unit="kWh" />
            <StatCard label="Water" value={sum('waterM3').toLocaleString('en-GB')} unit="m³" />
            <StatCard label="Waste" value={waste.toFixed(1)} unit="t" />
            <StatCard label="Waste recycled" value={waste ? fmtPct(recycled / waste, 0) : '—'} intent="positive" />
          </div>
        );
      }}
      columns={[
        { key: 'site', label: 'Site' },
        { key: 'period', label: 'Period' },
        { key: 'electricityKwh', label: 'Electricity kWh', numeric: true },
        { key: 'dieselLitres', label: 'Diesel l', numeric: true },
        { key: 'waterM3', label: 'Water m³', numeric: true },
        { key: 'wasteTonnes', label: 'Waste t', numeric: true },
        { key: 'recycledShare', label: 'Recycled', render: (i) => (i.data.recycledShare !== undefined && i.data.recycledShare !== null ? fmtPct(Number(i.data.recycledShare), 0) : '—') },
      ]}
    />
  );
}

export function SocialTab({ scope }: { scope: EntityCode }) {
  const { state } = useCbzData();
  const fi = state.financialInclusion.filter((f) => scope === 'GROUP' || f.subsidiary === scope);
  const beneficiaries = fi.reduce((s, f) => s + f.beneficiaryCount, 0);
  const disbursed = fi.reduce((s, f) => s + f.totalDisbursedUsd, 0);
  const female = beneficiaries ? fi.reduce((s, f) => s + f.femaleShare * f.beneficiaryCount, 0) / beneficiaries : 0;
  const repayment = disbursed ? fi.reduce((s, f) => s + f.repaymentRate * f.totalDisbursedUsd, 0) / disbursed : 0;
  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Inclusion beneficiaries" value={beneficiaries.toLocaleString('en-GB')} hint={`${fi.length} programmes`} intent="positive" />
        <StatCard label="Disbursed" value={fmtUsd(disbursed)} />
        <StatCard label="Women reached" value={fmtPct(female, 0)} hint="Beneficiary-weighted" />
        <StatCard label="Repayment rate" value={fmtPct(repayment, 0)} hint="Disbursement-weighted" />
      </div>
      <Panel title="Financial inclusion & development impact" subtitle="Beneficiaries, gender reach, geography and SDG alignment (F42)" padded={false}>
        {fi.length === 0 ? (
          <EmptyState title="No inclusion programmes in scope." hint="Import the Social-Fin Inclusion sheet in Data entry." />
        ) : (
          <div className="cbz-table-wrap">
            <table className="cbz-table">
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Entity</th>
                  <th>Geography</th>
                  <th className="cbz-num">Beneficiaries</th>
                  <th className="cbz-num">Women</th>
                  <th className="cbz-num">Disbursed</th>
                  <th className="cbz-num">Repayment</th>
                  <th>SDGs</th>
                  <th>Period</th>
                </tr>
              </thead>
              <tbody>
                {fi.map((f) => (
                  <tr key={f.id}>
                    <td>{f.programme}</td>
                    <td>{f.subsidiary}</td>
                    <td>{f.geography}</td>
                    <td className="cbz-num">{f.beneficiaryCount.toLocaleString('en-GB')}</td>
                    <td className="cbz-num">{fmtPct(f.femaleShare, 0)}</td>
                    <td className="cbz-num">{fmtUsd(f.totalDisbursedUsd)}</td>
                    <td className="cbz-num">{fmtPct(f.repaymentRate, 0)}</td>
                    <td>{f.sdgAlignment}</td>
                    <td>{f.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <RegisterView
        register="community-investment"
        title="Community investment"
        subtitle="Spend, beneficiaries and volunteer hours by programme (F25; GRI 203-1)."
        scope={scope}
        columns={[
          { key: 'programme', label: 'Programme' },
          { key: 'location', label: 'Location' },
          { key: 'spendUsd', label: 'Spend', render: (i) => fmtUsd(Number(i.data.spendUsd)), numeric: true },
          { key: 'beneficiaries', label: 'Beneficiaries', numeric: true },
          { key: 'volunteerHours', label: 'Volunteer hrs', numeric: true },
          { key: 'sdg', label: 'SDG' },
          { key: 'period', label: 'Period' },
        ]}
      />
      <MethodNote>Workforce diversity, training and safety KPIs are on the Group snapshot and in the disclosure centre (GRI 401-405).</MethodNote>
    </>
  );
}
