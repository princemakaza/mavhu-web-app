import { Link } from 'react-router-dom';
import { useCbzTheme } from '../../model/cbz/theme';
import { ThemeToggle } from '../cbz/components/ThemeToggle';

const PORTALS = [
  {
    to: '/bank',
    mark: 'BANK',
    title: 'Bank ESG portal',
    who: 'Staff and customers of client banks (CBZ, Stanbic, FBC, …)',
    roles: ['Bank admin', 'Approver', 'Contributor', 'Reader', 'Auditor (read-only)', 'Customer'],
    does: 'Capture, approve and lock ESG data; PCAF financed & insurance emissions; climate risk, scenarios and appetite; targets; disclosures and evidence.',
  },
  {
    to: '/agri',
    mark: 'MRV',
    title: 'Agri MRV portal',
    who: 'Agribusiness borrowers whose land MAvHU monitors',
    roles: ['ESG approver', 'ESG contributor', 'ESG reader'],
    does: 'Satellite NDVI and carbon stock per estate, crop cycles, farm emissions accounting with approval, and field verification.',
  },
  {
    to: '/admin',
    mark: 'MAvHU',
    title: 'MAvHU console',
    who: 'The MAvHU team',
    roles: ['MAvHU administrator', 'MAvHU auditor (read-only)'],
    does: 'Onboard banks and licence modules, manage every user and role, open any bank or farm, lock reporting periods, cross-bank audit.',
  },
];

/** Entry point: one platform, three portals, each role signing in to the one built for it. */
export function PortalLanding() {
  useCbzTheme();
  return (
    <div className="cbz-landing">
      <header className="cbz-landing__top">
        <div className="cbz-landing__brand">
          <span className="cbz-nav__mark cbz-nav__mark--mavhu">MAvHU</span>
          <div>
            <strong>MAvHU Africa</strong>
            <div className="cbz-muted">Climate data infrastructure for financial institutions</div>
          </div>
        </div>
        <ThemeToggle />
      </header>
      <section className="cbz-landing__hero">
        <p className="cbz-eyebrow">Measured. Verified. Sovereign.</p>
        <h1>One auditable source of ESG truth, from the loan book to the farm.</h1>
        <p className="cbz-landing__lead">
          Capture → validation → calculation → approval → disclosure → audit, on a tamper-evident trail, with satellite and field verification behind
          every land-based exposure.
        </p>
      </section>
      <section className="cbz-landing__grid" aria-label="Choose your portal">
        {PORTALS.map((p) => (
          <Link key={p.to} to={p.to} className="cbz-portal-card">
            <span className="cbz-portal-card__mark">{p.mark}</span>
            <h2>{p.title}</h2>
            <p className="cbz-portal-card__who">{p.who}</p>
            <p>{p.does}</p>
            <ul>
              {p.roles.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <span className="cbz-portal-card__go">Sign in →</span>
          </Link>
        ))}
      </section>
      <footer className="cbz-landing__foot">AWS Cape Town (af-south-1) · IFRS S1/S2 · GRI · PCAF · RBZ · Synthetic demo data in this environment</footer>
    </div>
  );
}
