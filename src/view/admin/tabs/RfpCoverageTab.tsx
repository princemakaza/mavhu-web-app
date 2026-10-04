import { Panel } from '../../cbz/components/primitives';

type Status = 'working' | 'prototype' | 'design' | 'not-built';

/**
 * RFP 1.10.1 mandatory demonstration items vs what this platform does today.
 * The meeting pack requires every item labelled Working / Prototype / Design and the data stated as synthetic.
 * Update this table when a capability changes; it is deliberately hand-maintained so the claims stay honest.
 */
const ITEMS: Array<{ item: string; refs: string; status: Status; where: string; gap?: string }> = [
  { item: 'Data collection workflows', refs: 'F1–F5, F19, F36', status: 'working', where: 'Bank dashboard → Data entry (file upload + manual form) and Workflow (draft → review → approved → locked)', gap: 'Named data-owner template per dataset not yet in the app' },
  { item: 'IFRS S1/S2 and GRI disclosure', refs: 'F6, F7, F45', status: 'design', where: 'Snapshot shows the metrics; framework tags only', gap: 'No metric-to-framework mapping table or disclosure index export' },
  { item: 'Dashboard creation', refs: 'F20, F46', status: 'working', where: 'Group / subsidiary scope, role-based tabs, per-bank licensed modules (Admin → Banks → Manage)' },
  { item: 'Financed emissions', refs: 'F10, F16, F17', status: 'prototype', where: 'Bank dashboard → Financed emissions (PCAF Part A, asset-class denominators, DQ score)', gap: 'Day-1 asset classes and Part B/C position still to be decided' },
  { item: 'Audit trail', refs: 'F18, NF13', status: 'prototype', where: 'Admin → Audit trail (cross-bank, CSV export); bank Workflow tab', gap: 'Entries record the action, not old and new values; tamper-evidence not implemented' },
  { item: 'Climate risk reporting', refs: 'F14, F15, F30, F37', status: 'prototype', where: 'Bank dashboard → Risk heatmap + geospatial records', gap: 'No Climate VaR, NGFS scenarios or stress test' },
  { item: 'ESG risk register', refs: 'F29, F32', status: 'working', where: 'Bank dashboard → Risk heatmap: physical, transition, liability and opportunity entries with owners' },
  { item: 'Materiality assessment', refs: 'F24', status: 'not-built', where: '—', gap: 'Workflow and screens to be designed (Hosea)' },
  { item: 'Sustainable finance taxonomy', refs: 'F22', status: 'not-built', where: '—', gap: 'AfDB/ICMA loan tagging not modelled' },
  { item: 'Audit evidence repository', refs: 'F38', status: 'prototype', where: 'Emission records carry a source file reference; ingestion log lists uploads', gap: 'Source files are referenced, not stored or linked for download' },
  { item: 'ESG assurance workflows', refs: 'F19, F38', status: 'working', where: 'Read-only auditor role; Admin → Reporting periods locks a period so records cannot change' },
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
