import { Panel } from '../../cbz/components/primitives';

type Status = 'working' | 'prototype' | 'design' | 'not-built';

/**
 * RFP 1.10.1 mandatory demonstration items vs what this platform does today.
 * The meeting pack requires every item labelled Working / Prototype / Design and the data stated as synthetic.
 * Update this table when a capability changes; it is deliberately hand-maintained so the claims stay honest.
 */
const ITEMS: Array<{ item: string; refs: string; status: Status; where: string; gap?: string }> = [
  { item: 'Data collection workflows', refs: 'F1–F5, F19, F36', status: 'working', where: 'Bank portal → Data entry (form + Excel/CSV import with validation) → Workflow & audit (submit, send back, approve, lock); Governance → Data ownership', gap: 'No live API/SFTP connector to a core banking system yet' },
  { item: 'IFRS S1/S2 and GRI disclosure', refs: 'F6, F7, F45', status: 'working', where: 'Reporting → Disclosures: one metric catalogue tagged to IFRS S2, GRI, TCFD, SASB, SDG, TNFD and RBZ/ZSE/EMA/IPEC/SECZim; publish a locked version; export Excel, CSV, Word, JSON, PDF', gap: 'No XBRL; narrative items (e.g. board oversight) not yet captured; local mapping labels need regulator validation' },
  { item: 'Dashboard creation', refs: 'F20, F46', status: 'working', where: 'Group / subsidiary scope, role-based views, per-bank licensed modules (Console → Banks → Manage); Targets & KPIs with year-on-year variation' },
  { item: 'Financed emissions', refs: 'F10, F16, F17', status: 'prototype', where: 'Finance → Financed emissions (PCAF Part A, DQ score, MRV-verified borrowers, MRV prioritisation); Insurance emissions (Part C)', gap: 'Part B (facilitated) not stored; Day-1 asset classes still to be confirmed' },
  { item: 'Audit trail', refs: 'F18, NF13', status: 'working', where: 'Reporting → Workflow & audit: append-only, SHA-256 hash-chained log with before/after values, "Verify chain", CSV export; database blocks edits and deletes' },
  { item: 'Climate risk reporting', refs: 'F14, F15, F30, F37', status: 'prototype', where: 'Climate risk → Risks & incidents (heat map, re-rate) and Scenarios & Climate VaR (3 NGFS scenarios, exposure by sector/geography, assumptions table)', gap: 'Parameters illustrative until validated; no NGFS data feed or collateral revaluation' },
  { item: 'ESG risk register', refs: 'F29, F32', status: 'working', where: 'Climate risk → Risks & incidents: physical, transition, liability, social, governance and opportunity entries with owners, re-rating and audit trail' },
  { item: 'Materiality assessment', refs: 'F24', status: 'working', where: 'Governance → Materiality: double-materiality matrix with TNFD LEAP phase per topic; feeds GRI 3-2 in disclosures', gap: 'No stakeholder survey workflow (scores are entered)' },
  { item: 'Sustainable finance taxonomy', refs: 'F22', status: 'working', where: 'Finance → Sustainable finance: tag instruments to AfDB / ICMA / local taxonomy, eligibility status, green asset ratio, ESG-linked product KPIs', gap: 'Eligibility criteria are judged by the user, not tested automatically' },
  { item: 'Audit evidence repository', refs: 'F38', status: 'working', where: 'Reporting → Evidence; attach files to any record from Workflow; SHA-256 checked on download', gap: 'No retention-schedule automation (7-year rule is policy, not enforced)' },
  { item: 'ESG assurance workflows', refs: 'F19, F38', status: 'working', where: 'Bank auditor role and MAvHU auditor (Console, read-only); segregation of duties (no self-approval); locked periods (Console → Reporting periods)' },
];

const LABEL: Record<Status, string> = { working: 'Working', prototype: 'Prototype', design: 'Design', 'not-built': 'Not built' };

export function RfpCoverageTab() {
  const counts = ITEMS.reduce<Record<Status, number>>((acc, i) => ({ ...acc, [i.status]: acc[i.status] + 1 }), { working: 0, prototype: 0, design: 0, 'not-built': 0 });

  return (
    <Panel
      title="CBZ RFP: mandatory demonstration items (1.10.1)"
      subtitle={`${counts.working} working · ${counts.prototype} prototype · ${counts.design} design · ${counts['not-built']} not built. All data in this environment is synthetic.`}
      padded={false}
    >
      <div className="cbz-table-wrap">
        <table className="cbz-table">
          <thead>
            <tr>
              <th>RFP item</th>
              <th>Refs</th>
              <th>Status</th>
              <th>Where to demo it</th>
              <th>Known gap</th>
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((i) => (
              <tr key={i.item}>
                <td>{i.item}</td>
                <td className="cbz-mono cbz-muted">{i.refs}</td>
                <td>
                  <span className={`cbz-badge cbz-badge--rfp-${i.status}`}>{LABEL[i.status]}</span>
                </td>
                <td>{i.where}</td>
                <td className="cbz-muted">{i.gap ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
