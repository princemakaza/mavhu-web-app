import { useMemo } from 'react';
import { useCbz } from '../../../model/cbz/useCbz';
import type { EntityCode } from '../../../model/cbz/types';
import { BarChart, DoughnutChart } from '../components/charts';
import { EmptyState, Panel, StatCard, fmtPct, fmtT, fmtUsd } from '../components/primitives';

export function EntityTab({ scope }: { scope: EntityCode }) {
  const state = useCbz();

  if (scope === 'GROUP') {
    return <EmptyState title="Select a subsidiary to view its detail." hint="Use the Scope selector above." />;
  }

  const entity = state.entities.find((e) => e.code === scope);
  if (!entity) return <EmptyState title="Unknown entity." />;

  const emissions = state.emissions.filter((e) => e.entityCode === scope);
  const scope1 = emissions.filter((e) => e.scope === 'scope1').reduce((s, r) => s + r.emissionsTco2e, 0);
  const scope2 = emissions.filter((e) => e.scope === 'scope2').reduce((s, r) => s + r.emissionsTco2e, 0);
  const scope3 = emissions.filter((e) => e.scope === 'scope3').reduce((s, r) => s + r.emissionsTco2e, 0);
  const total = scope1 + scope2 + scope3;

  const workforce = state.workforce.find((w) => w.subsidiary === scope);
  const departments = state.departments.filter((d) => d.entityCode === scope);
  const members = state.members.filter((m) => m.entityCode === scope);
  const financialInclusion = state.financialInclusion.filter((f) => f.subsidiary === scope);
  const incidents = state.incidents.filter((i) => i.subsidiary === scope);
  const geospatial = state.geospatial.filter((g) => g.subsidiary === scope);

  const sitesData = useMemo(() => {
    const bySite = new Map<string, number>();
    for (const rec of emissions) {
      bySite.set(rec.site, (bySite.get(rec.site) ?? 0) + rec.emissionsTco2e);
    }
    return [...bySite.entries()].map(([label, value]) => ({ label, value: +value.toFixed(2) }));
  }, [emissions]);

  return (
    <>
      <Panel padded>
        <div className="cbz-entity-head">
          <div>
            <div className="cbz-eyebrow">{entity.regulator} regulated · {entity.segment}</div>
            <h2>{entity.name}</h2>
            <p className="cbz-muted">{entity.notes || 'No additional notes.'}</p>
            <div className="cbz-tag-row">
              <span className="cbz-tag">Code: {entity.code}</span>
              <span className="cbz-tag">PCAF: {entity.pcafApplicable}</span>
              <span className="cbz-tag">{departments.length} departments</span>
              <span className="cbz-tag">{members.length} members</span>
            </div>
          </div>
        </div>
      </Panel>

      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Total emissions" value={fmtT(total, 1)} unit="tCO2e" intent="warning" />
        <StatCard label="Scope 1" value={fmtT(scope1, 1)} unit="tCO2e" />
        <StatCard label="Scope 2" value={fmtT(scope2, 1)} unit="tCO2e" />
        <StatCard label="Scope 3" value={fmtT(scope3, 1)} unit="tCO2e" />
        <StatCard
          label="Headcount"
          value={workforce ? workforce.headcount.toLocaleString() : '—'}
          hint={workforce ? `Female ${fmtPct(workforce.femaleShare)}` : undefined}
        />
        <StatCard
          label="ESG incidents"
          value={String(incidents.length)}
          hint={`${incidents.filter((i) => i.status !== 'Closed').length} open`}
          intent={incidents.some((i) => i.status !== 'Closed') ? 'negative' : 'positive'}
        />
      </div>

      <div className="cbz-grid cbz-grid--halves">
        <Panel title="Emissions by site" subtitle="Sum across current period">
          {sitesData.length ? (
            <BarChart data={sitesData} unit="tCO2e" ariaLabel="Emissions by site" />
          ) : (
            <EmptyState title="No emissions recorded for this entity yet." />
          )}
        </Panel>

        <Panel title="Scope split" subtitle="Direct, energy, value chain">
          <DoughnutChart
            centerLabel="tCO2e"
            centerValue={fmtT(total, 1)}
            segments={[
              { label: 'Scope 1', value: scope1, color: '#0f2b45' },
              { label: 'Scope 2', value: scope2, color: '#b8860b' },
              { label: 'Scope 3', value: scope3, color: '#0e7c66' },
            ]}
          />
        </Panel>
      </div>

      <div className="cbz-grid cbz-grid--halves">
        <Panel title="Departments" subtitle="Business units inside this entity">
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Kind</th>
                  <th>Head</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{d.kind}</td>
                    <td>{d.headOfDept}</td>
                    <td className="cbz-muted">{d.email}</td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={4}><EmptyState title="No departments yet." hint="Add one from the Members tab." /></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Members" subtitle="Users and customer accounts scoped to this entity">
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.fullName}</td>
                    <td>
                      <span className={`cbz-chip cbz-chip--role cbz-chip--role-${m.role}`}>{m.role}</span>
                    </td>
                    <td className="cbz-muted">{m.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {financialInclusion.length > 0 && (
        <Panel title="Financial inclusion" subtitle="Beneficiaries, disbursement and repayment health">
          <div className="cbz-table-wrap">
            <table className="cbz-table">
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Geography</th>
                  <th className="cbz-num">Beneficiaries</th>
                  <th className="cbz-num">Female share</th>
                  <th className="cbz-num">Disbursed</th>
                  <th className="cbz-num">Repayment</th>
                </tr>
              </thead>
              <tbody>
                {financialInclusion.map((f) => (
                  <tr key={f.id}>
                    <td>{f.programme}</td>
                    <td>{f.geography}</td>
                    <td className="cbz-num">{f.beneficiaryCount.toLocaleString()}</td>
                    <td className="cbz-num">{fmtPct(f.femaleShare)}</td>
                    <td className="cbz-num">{fmtUsd(f.totalDisbursedUsd)}</td>
                    <td className="cbz-num">{fmtPct(f.repaymentRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {geospatial.length > 0 && (
        <Panel title="Satellite & geospatial monitoring" subtitle="MRV uplift powering DQ 2–3 counterparties">
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Borrower / site</th>
                  <th>District</th>
                  <th>Pass date</th>
                  <th>Source</th>
                  <th>NDVI</th>
                  <th>Land use</th>
                  <th>Deforestation</th>
                  <th>Flood / Drought</th>
                </tr>
              </thead>
              <tbody>
                {geospatial.map((g) => (
                  <tr key={g.id}>
                    <td>{g.linkedBorrowerName}</td>
                    <td>{g.district}</td>
                    <td>{g.passDate}</td>
                    <td>{g.dataSource}</td>
                    <td>{g.ndvi === null ? '—' : g.ndvi.toFixed(2)}</td>
                    <td>{g.landUse}</td>
                    <td>{g.deforestationFlag}</td>
                    <td>{g.floodRisk} / {g.droughtStress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {incidents.length > 0 && (
        <Panel title="ESG incidents" subtitle="Environmental, social and governance events registered">
          <div className="cbz-table-wrap">
            <table className="cbz-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Closure</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td className="cbz-mono">{i.id}</td>
                    <td>{i.category}</td>
                    <td>
                      <span className={`cbz-pill cbz-pill--sev-${i.severity.toLowerCase()}`}>{i.severity}</span>
                    </td>
                    <td>{i.description}</td>
                    <td>
                      <span className={`cbz-badge cbz-badge--incident-${i.status.replace(' ', '').toLowerCase()}`}>
                        {i.status}
                      </span>
                    </td>
                    <td>{i.closureDate ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
