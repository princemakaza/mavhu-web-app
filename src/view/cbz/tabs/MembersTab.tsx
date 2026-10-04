import { useMemo, useState } from 'react';
import { apiAddDepartment, apiAddMember } from '../../../model/cbz/cbz_api';
import { useCbzData } from '../../../model/cbz/CbzDataContext';
import { useCbz } from '../../../model/cbz/useCbz';
import type { CbzSession, DepartmentKind, EntityCode, Member } from '../../../model/cbz/types';
import { EmptyState, Panel, StatCard, fmtDateTime } from '../components/primitives';

const DEPT_KINDS: DepartmentKind[] = [
  'Commercial Banking',
  'Investment Banking',
  'Asset Management',
  'Agribusiness',
  'Property',
  'Short-term Insurance',
  'Life Assurance',
  'Risk Advisory',
  'Microfinance',
];

const ROLES: Array<Member['role']> = ['contributor', 'approver', 'reader', 'auditor', 'customer'];

export function MembersTab({ session }: { session: CbzSession }) {
  const state = useCbz();
  const [entityFilter, setEntityFilter] = useState<EntityCode | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'all' | Member['role']>('all');
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const members = useMemo(
    () => state.members.filter((m) => (entityFilter === 'ALL' || m.entityCode === entityFilter) && (roleFilter === 'all' || m.role === roleFilter)),
    [state.members, entityFilter, roleFilter],
  );

  const staffCount = state.members.filter((m) => m.role !== 'customer').length;
  const customerCount = state.members.filter((m) => m.role === 'customer').length;

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Subsidiaries" value={String(state.entities.length)} hint="Legal entities" />
        <StatCard label="Departments" value={String(state.departments.length)} hint="Across the group" />
        <StatCard label="Staff members" value={String(staffCount)} intent="positive" />
        <StatCard label="Customer accounts" value={String(customerCount)} intent="neutral" hint="Clients able to self-submit" />
      </div>

      <Panel
        title="Subsidiaries & departments"
        subtitle="The group's legal entities and the business units under them. Adding a department creates a bucket for members and customers."
        action={
          session.role === 'admin' ? (
            <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setShowAddDept(true)}>
              + Add department
            </button>
          ) : undefined
        }
      >
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Segment</th>
                <th>Regulator</th>
                <th>Departments</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {state.entities.map((e) => {
                const depts = state.departments.filter((d) => d.entityCode === e.code);
                const staff = state.members.filter((m) => m.entityCode === e.code);
                return (
                  <tr key={e.code}>
                    <td>
                      <div>{e.name}</div>
                      <div className="cbz-mono cbz-muted">{e.code}</div>
                    </td>
                    <td>{e.segment}</td>
                    <td>{e.regulator}</td>
                    <td>
                      <ul className="cbz-inline-list">
                        {depts.map((d) => (
                          <li key={d.id}>
                            <strong>{d.name}</strong>
                            <span className="cbz-muted"> · {d.kind}</span>
                          </li>
                        ))}
                        {depts.length === 0 && <li className="cbz-muted">None yet</li>}
                      </ul>
                    </td>
                    <td>{staff.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Members"
        subtitle="Staff, approvers and customer accounts. Customers see only their own entity and its data-entry tab."
        action={
          <div className="cbz-toolbar">
            <label className="cbz-field cbz-field--inline">
              <span>Entity</span>
              <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value as typeof entityFilter)}>
                <option value="ALL">All entities</option>
                {state.entities.map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field cbz-field--inline">
              <span>Role</span>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
                <option value="all">All roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={() => setShowAddCustomer(true)}>
              + Add customer
            </button>
            <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setShowAddMember(true)}>
              + Add staff member
            </button>
          </div>
        }
      >
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Entity</th>
                <th>Department</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const dept = state.departments.find((d) => d.id === m.departmentId);
                return (
                  <tr key={m.id}>
                    <td>
                      <div>{m.fullName}</div>
                      <div className="cbz-muted">{m.phone}</div>
                    </td>
                    <td className="cbz-muted">{m.email}</td>
                    <td>{m.entityCode}</td>
                    <td>{dept?.name ?? '—'}</td>
                    <td>
                      <span className={`cbz-chip cbz-chip--role cbz-chip--role-${m.role}`}>{m.role}</span>
                    </td>
                    <td>{fmtDateTime(m.createdAt)}</td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No members for this filter." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {showAddDept && <AddDepartmentModal onClose={() => setShowAddDept(false)} actor={session.fullName} />}
      {showAddMember && <AddMemberModal onClose={() => setShowAddMember(false)} actor={session.fullName} customerOnly={false} />}
      {showAddCustomer && <AddMemberModal onClose={() => setShowAddCustomer(false)} actor={session.fullName} customerOnly={true} />}
    </>
  );
}

function AddDepartmentModal({ onClose, actor }: { onClose: () => void; actor: string }) {
  const state = useCbz();
  const { refresh } = useCbzData();
  const [entityCode, setEntityCode] = useState<EntityCode>(state.entities[0]?.code ?? '');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<DepartmentKind>('Commercial Banking');
  const [head, setHead] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !head.trim() || !email.trim()) {
      setError('Name, head-of-department and email are all required.');
      return;
    }
    try {
      await apiAddDepartment({ entityCode, name: name.trim(), kind, headOfDept: head.trim(), email: email.trim() });
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add department.');
    }
  }

  return (
    <div className="cbz-modal-backdrop" role="dialog" aria-modal="true">
      <div className="cbz-modal">
        <header className="cbz-modal__head">
          <div>
            <h3>Register a department</h3>
            <p className="cbz-muted">Business unit inside a subsidiary.</p>
          </div>
          <button type="button" className="cbz-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form className="cbz-modal__body" onSubmit={submit}>
          <div className="cbz-grid cbz-grid--form">
            <label className="cbz-field">
              <span>Entity</span>
              <select value={entityCode} onChange={(e) => setEntityCode(e.target.value as EntityCode)}>
                {state.entities.map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field">
              <span>Kind</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as DepartmentKind)}>
                {DEPT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field">
              <span>Department name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Retail & Mortgages" required />
            </label>
            <label className="cbz-field">
              <span>Head of department</span>
              <input value={head} onChange={(e) => setHead(e.target.value)} required />
            </label>
            <label className="cbz-field cbz-field--wide">
              <span>Contact email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
          </div>
          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
          <footer className="cbz-modal__foot">
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cbz-btn cbz-btn--primary">
              Register department
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function AddMemberModal({ onClose, actor: _actor, customerOnly }: { onClose: () => void; actor: string; customerOnly: boolean }) {
  const state = useCbz();
  const { refresh } = useCbzData();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [entityCode, setEntityCode] = useState<EntityCode>(state.entities[0]?.code ?? '');
  const [departmentId, setDepartmentId] = useState<string | ''>('');
  const [role, setRole] = useState<Member['role']>(customerOnly ? 'customer' : 'contributor');
  const [error, setError] = useState<string | null>(null);

  const departmentsForEntity = state.departments.filter((d) => d.entityCode === entityCode);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email are required.');
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('That does not look like a valid email.');
      return;
    }
    try {
      await apiAddMember({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || 'n/a',
        entityCode,
        departmentId: departmentId || null,
        role: customerOnly ? 'customer' : role,
        password: 'cbz-demo',
      });
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save member.');
    }
  }

  return (
    <div className="cbz-modal-backdrop" role="dialog" aria-modal="true">
      <div className="cbz-modal">
        <header className="cbz-modal__head">
          <div>
            <h3>{customerOnly ? 'Onboard a customer' : 'Add a staff member'}</h3>
            <p className="cbz-muted">
              {customerOnly
                ? 'Customers get read-only access to their own entity plus a data-entry form. Use this to enable client self-service.'
                : 'Contributors submit data · approvers sign it off · readers browse · auditors review read-only.'}
            </p>
          </div>
          <button type="button" className="cbz-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form className="cbz-modal__body" onSubmit={submit}>
          <div className="cbz-grid cbz-grid--form">
            <label className="cbz-field">
              <span>Full name</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label className="cbz-field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="cbz-field">
              <span>Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263 …" />
            </label>
            <label className="cbz-field">
              <span>Entity</span>
              <select value={entityCode} onChange={(e) => setEntityCode(e.target.value as EntityCode)}>
                {state.entities.map((en) => (
                  <option key={en.code} value={en.code}>
                    {en.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field">
              <span>Department</span>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">— None —</option>
                {departmentsForEntity.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {!customerOnly && (
              <label className="cbz-field">
                <span>Role</span>
                <select value={role} onChange={(e) => setRole(e.target.value as Member['role'])}>
                  {ROLES.filter((r) => r !== 'customer').map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {error && <p className="cbz-alert cbz-alert--danger">{error}</p>}
          <footer className="cbz-modal__foot">
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cbz-btn cbz-btn--primary">
              {customerOnly ? 'Onboard customer' : 'Add member'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
