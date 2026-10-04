import { useState } from 'react';
import { adminApi, generateTempPassword } from '../../../model/admin/adminApi';
import type { AdminSession, TeamMember, TeamRole } from '../../../model/admin/types';
import { Panel, fmtDateTime } from '../../cbz/components/primitives';
import { ErrorNote, Loading, Modal } from '../shared';
import { useLoad } from '../useLoad';

const TEAM_ROLES: Array<{ key: TeamRole; label: string; hint: string }> = [
  { key: 'MAVHU_ADMIN', label: 'Admin', hint: 'Full admin console: banks, users, periods, audit' },
  { key: 'AUDITOR', label: 'Auditor', hint: 'Platform-level read-only assurance' },
];

export function TeamTab({ session }: { session: AdminSession }) {
  const { data, error, loading, reload } = useLoad(() => adminApi.team(), []);
  const [showAdd, setShowAdd] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  async function update(member: TeamMember, body: Parameters<typeof adminApi.updateTeamMember>[1]) {
    setRowError(null);
    try {
      await adminApi.updateTeamMember(member.id, body);
      await reload();
    } catch (err) {
      setRowError(`${member.name}: ${err instanceof Error ? err.message : 'update failed'}`);
    }
  }

  function toggleRole(member: TeamMember, role: TeamRole, on: boolean) {
    const next = (on ? [...member.roles, role] : member.roles.filter((r) => r !== role)).filter(
      (r): r is TeamRole => r === 'MAVHU_ADMIN' || r === 'AUDITOR',
    );
    if (next.length === 0) {
      setRowError(`${member.name}: keep at least one role, or deactivate the account instead.`);
      return;
    }
    void update(member, { roles: [...new Set(next)] });
  }

  return (
    <>
      <Panel
        title="MAvHU team"
        subtitle="Staff who sign in to this console. You cannot remove your own admin access."
        action={
          <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setShowAdd(true)}>
            + Add team member
          </button>
        }
        padded={false}
      >
        {error && <ErrorNote message={error} onRetry={reload} />}
        {rowError && <p className="cbz-alert cbz-alert--danger">{rowError}</p>}
        {loading && !data ? (
          <Loading />
        ) : (
          <div className="cbz-table-wrap">
            <table className="cbz-table">
              <thead>
                <tr>
                  <th>Name</th>
                  {TEAM_ROLES.map((r) => (
                    <th key={r.key} title={r.hint}>
                      {r.label}
                    </th>
                  ))}
                  <th>Joined</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((m) => {
                  const isSelf = m.id === session.userId;
                  return (
                    <tr key={m.id} className={m.isDeleted ? 'cbz-row--inactive' : undefined}>
                      <td>
                        <div>
                          {m.name}
                          {isSelf && <span className="cbz-muted"> (you)</span>}
                        </div>
                        <div className="cbz-muted">{m.email}</div>
                      </td>
                      {TEAM_ROLES.map((r) => (
                        <td key={r.key}>
                          <input
                            type="checkbox"
                            aria-label={`${r.label} role for ${m.name}`}
                            checked={m.roles.includes(r.key)}
                            disabled={m.isDeleted || (isSelf && r.key === 'MAVHU_ADMIN')}
                            onChange={(e) => toggleRole(m, r.key, e.target.checked)}
                          />
                        </td>
                      ))}
                      <td className="cbz-muted">{fmtDateTime(m.createdAt)}</td>
                      <td>{m.isDeleted ? 'Deactivated' : 'Active'}</td>
                      <td>
                        {!isSelf && (
                          <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => update(m, { isActive: m.isDeleted })}>
                            {m.isDeleted ? 'Reactivate' : 'Deactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {showAdd && (
        <AddTeamMemberModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            void reload();
          }}
        />
      )}
    </>
  );
}

function AddTeamMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: generateTempPassword() });
  const [roles, setRoles] = useState<TeamRole[]>(['MAVHU_ADMIN']);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    if (!form.name.trim() || !form.email.trim() || roles.length === 0) {
      setError('Name, email and at least one role are required.');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.createTeamMember({ name: form.name.trim(), email: form.email.trim(), password: form.password, roles });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the team member.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Add a MAvHU team member" subtitle="They sign in at /admin with this email and temporary password." onClose={onClose} onSubmit={submit} submitLabel="Add member" submitting={submitting} error={error}>
      <div className="cbz-grid cbz-grid--form">
        <label className="cbz-field">
          <span>Full name</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="cbz-field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@mavhu.africa" />
        </label>
        <label className="cbz-field cbz-field--wide">
          <span>Temporary password</span>
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} />
        </label>
      </div>
      <div className="cbz-section-title">Roles</div>
      <div className="cbz-check-grid">
        {TEAM_ROLES.map((r) => (
          <label key={r.key} className="cbz-check" title={r.hint}>
            <input
              type="checkbox"
              checked={roles.includes(r.key)}
              onChange={(e) => setRoles(e.target.checked ? [...roles, r.key] : roles.filter((x) => x !== r.key))}
            />
            {r.label}
          </label>
        ))}
      </div>
    </Modal>
  );
}
