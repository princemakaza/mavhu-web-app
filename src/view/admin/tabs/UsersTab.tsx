import { useMemo, useState } from 'react';
import { adminApi, generateTempPassword } from '../../../model/admin/adminApi';
import { MEMBER_ROLES, type AdminMember, type MemberRole } from '../../../model/admin/types';
import { EmptyState, Panel, StatCard } from '../../cbz/components/primitives';
import { ErrorNote, Loading, Modal } from '../shared';
import { useLoad } from '../useLoad';

export function UsersTab() {
  const banks = useLoad(() => adminApi.banks(), []);
  const [bankId, setBankId] = useState<number | 0>(0);
  const members = useLoad(() => adminApi.members(bankId || undefined), [bankId]);
  const [roleFilter, setRoleFilter] = useState<MemberRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [resetting, setResetting] = useState<AdminMember | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (members.data ?? []).filter(
      (m) =>
        (roleFilter === 'all' || m.role === roleFilter) &&
        (statusFilter === 'all' || (statusFilter === 'active') === m.isActive) &&
        (!term || `${m.fullName} ${m.email} ${m.entityName}`.toLowerCase().includes(term)),
    );
  }, [members.data, roleFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const all = members.data ?? [];
    const active = all.filter((m) => m.isActive);
    return {
      active: active.length,
      inactive: all.length - active.length,
      admins: active.filter((m) => m.role === 'admin').length,
      auditors: active.filter((m) => m.role === 'auditor').length,
    };
  }, [members.data]);

  async function update(member: AdminMember, body: Parameters<typeof adminApi.updateMember>[1]) {
    setBusyId(member.id);
    setRowError(null);
    try {
      await adminApi.updateMember(member.id, body);
      await members.reload();
    } catch (err) {
      setRowError(`${member.fullName}: ${err instanceof Error ? err.message : 'update failed'}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Active users" value={String(counts.active)} hint={bankId ? 'In this bank' : 'Across all banks'} intent="positive" />
        <StatCard label="Bank admins" value={String(counts.admins)} hint="Manage their own bank's members" />
        <StatCard label="Auditors" value={String(counts.auditors)} hint="Read-only assurance access" />
        <StatCard label="Deactivated" value={String(counts.inactive)} hint="Cannot sign in; history kept" intent={counts.inactive ? 'warning' : 'neutral'} />
      </div>

      <Panel
        title="Bank users"
        subtitle="Change a role in the table and it applies at the user's next sign-in. Every change is written to the bank's audit trail."
        action={
          <div className="cbz-toolbar">
            <label className="cbz-field cbz-field--inline">
              <span>Bank</span>
              <select value={bankId} onChange={(e) => setBankId(Number(e.target.value))}>
                <option value={0}>All banks</option>
                {(banks.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field cbz-field--inline">
              <span>Role</span>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
                <option value="all">All roles</option>
                {MEMBER_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field cbz-field--inline">
              <span>Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                <option value="active">Active</option>
                <option value="inactive">Deactivated</option>
                <option value="all">All</option>
              </select>
            </label>
            <label className="cbz-field cbz-field--inline">
              <span>Search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, subsidiary" />
            </label>
            <button type="button" className="cbz-btn cbz-btn--primary" disabled={!banks.data} onClick={() => setShowAdd(true)}>
              + Add user
            </button>
          </div>
        }
        padded={false}
      >
        {members.error && <ErrorNote message={members.error} onRetry={members.reload} />}
        {rowError && <p className="cbz-alert cbz-alert--danger">{rowError}</p>}
        {members.loading && !members.data ? (
          <Loading />
        ) : (
          <div className="cbz-table-wrap">
            <table className="cbz-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Bank</th>
                  <th>Subsidiary</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className={m.isActive ? undefined : 'cbz-row--inactive'}>
                    <td>
                      <div>{m.fullName}</div>
                      <div className="cbz-muted">{m.email}</div>
                    </td>
                    <td>{m.bankName}</td>
                    <td>
                      <div>{m.entityName}</div>
                      <div className="cbz-mono cbz-muted">{m.entityCode}</div>
                    </td>
                    <td>
                      <select
                        aria-label={`Role for ${m.fullName}`}
                        value={m.role}
                        disabled={busyId === m.id}
                        onChange={(e) => update(m, { role: e.target.value as MemberRole })}
                      >
                        {MEMBER_ROLES.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{m.isActive ? 'Active' : 'Deactivated'}</td>
                    <td>
                      <div className="cbz-toolbar">
                        <button
                          type="button"
                          className="cbz-btn cbz-btn--sm cbz-btn--ghost"
                          disabled={busyId === m.id}
                          onClick={() => update(m, { isActive: !m.isActive })}
                        >
                          {m.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => setResetting(m)}>
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title="No users match these filters." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="What each role can do" subtitle="Bank portal roles (the MAvHU team's own roles are on the MAvHU team page).">
        <div className="cbz-table-wrap">
          <table className="cbz-table cbz-table--compact">
            <tbody>
              {MEMBER_ROLES.map((r) => (
                <tr key={r.key}>
                  <td>
                    <span className={`cbz-chip cbz-chip--role cbz-chip--role-${r.key}`}>{r.label}</span>
                  </td>
                  <td className="cbz-muted">{r.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {showAdd && (
        <AddUserModal
          banks={(banks.data ?? []).filter((b) => b.entities > 0).map((b) => ({ id: b.id, name: b.name }))}
          defaultBankId={bankId || undefined}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            void members.reload();
          }}
        />
      )}
      {resetting && <ResetPasswordModal member={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}

function AddUserModal({
  banks,
  defaultBankId,
  onClose,
  onCreated,
}: {
  banks: Array<{ id: number; name: string }>;
  defaultBankId?: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [bankId, setBankId] = useState<number>(defaultBankId ?? banks[0]?.id ?? 0);
  const detail = useLoad(() => (bankId ? adminApi.bank(bankId) : Promise.resolve(null)), [bankId]);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', entityCode: '', departmentId: '', role: 'contributor' as MemberRole, password: generateTempPassword() });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const entities = detail.data?.entities ?? [];
  const entityCode = entities.some((e) => e.code === form.entityCode) ? form.entityCode : (entities[0]?.code ?? '');
  const departments = (detail.data?.departments ?? []).filter((d) => d.entityCode === entityCode);

  async function submit() {
    setError(null);
    if (!form.fullName.trim() || !form.email.trim() || !entityCode) {
      setError('Name, email and subsidiary are required.');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.createMember({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        entityCode,
        departmentId: form.departmentId || null,
        role: form.role,
        password: form.password,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the user.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Add a bank user" subtitle="They sign in on the bank portal with this email and the temporary password." onClose={onClose} onSubmit={submit} submitLabel="Create user" submitting={submitting} error={error}>
      <div className="cbz-grid cbz-grid--form">
        <label className="cbz-field">
          <span>Bank</span>
          <select value={bankId} onChange={(e) => setBankId(Number(e.target.value))}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cbz-field">
          <span>Subsidiary</span>
          <select value={entityCode} onChange={(e) => setForm({ ...form, entityCode: e.target.value, departmentId: '' })}>
            {entities.map((e) => (
              <option key={e.code} value={e.code}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cbz-field">
          <span>Department</span>
          <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
            <option value="">— None —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cbz-field">
          <span>Role</span>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}>
            {MEMBER_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}: {r.hint}
              </option>
            ))}
          </select>
        </label>
        <label className="cbz-field">
          <span>Full name</span>
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </label>
        <label className="cbz-field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="cbz-field">
          <span>Phone</span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+263 …" />
        </label>
        <label className="cbz-field">
          <span>Temporary password</span>
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} />
        </label>
      </div>
      {banks.length === 0 && <p className="cbz-alert cbz-alert--info">Add a subsidiary to a bank before creating its users.</p>}
    </Modal>
  );
}

function ResetPasswordModal({ member, onClose }: { member: AdminMember; onClose: () => void }) {
  const [password, setPassword] = useState(generateTempPassword);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.resetPassword(member.id, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Reset password for ${member.fullName}`}
      subtitle={member.email}
      onClose={onClose}
      onSubmit={done ? undefined : submit}
      submitLabel="Set password"
      submitting={submitting}
      error={error}
    >
      {done ? (
        <p className="cbz-alert cbz-alert--success">
          Password updated. Share <span className="cbz-mono">{password}</span> with {member.fullName} securely.
        </p>
      ) : (
        <label className="cbz-field">
          <span>New password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
        </label>
      )}
    </Modal>
  );
}
