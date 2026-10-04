import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, generateTempPassword } from '../../../model/admin/adminApi';
import { DASHBOARD_MODULES, type BankStats, type BankStatus } from '../../../model/admin/types';
import { EmptyState, Panel, fmtUsd } from '../../cbz/components/primitives';
import { BankStatusBadge, ErrorNote, Loading, Modal, relativeTime } from '../shared';
import { useLoad } from '../useLoad';

const STATUSES: BankStatus[] = ['onboarding', 'active', 'suspended'];
const ALL_MODULES = DASHBOARD_MODULES.map((m) => m.key);

export function BanksTab() {
  const navigate = useNavigate();
  const { data: banks, error, loading, reload } = useLoad(() => adminApi.banks(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [managing, setManaging] = useState<number | null>(null);

  return (
    <>
      <Panel
        title="Client banks"
        subtitle="Onboarding creates the bank, and optionally its first subsidiary and bank administrator, in one step."
        action={
          <button type="button" className="cbz-btn cbz-btn--primary" onClick={() => setShowCreate(true)}>
            + Onboard bank
          </button>
        }
        padded={false}
      >
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading && !banks ? (
          <Loading />
        ) : (
          <div className="cbz-table-wrap">
            <table className="cbz-table">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Status</th>
                  <th>Contact</th>
                  <th className="cbz-num">Subsidiaries</th>
                  <th className="cbz-num">Users</th>
                  <th>Licensed modules</th>
                  <th className="cbz-num">Exposure</th>
                  <th>Last activity</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(banks ?? []).map((bank: BankStats) => (
                  <tr key={bank.id}>
                    <td>
                      <div>{bank.name}</div>
                      <div className="cbz-mono cbz-muted">
                        {bank.identifier} · {bank.country}
                      </div>
                    </td>
                    <td>
                      <BankStatusBadge status={bank.status} />
                    </td>
                    <td className="cbz-muted">
                      <div>{bank.email}</div>
                      <div>{bank.phoneNumber ?? ''}</div>
                    </td>
                    <td className="cbz-num">{bank.entities}</td>
                    <td className="cbz-num">
                      {bank.activeMembers}
                      {bank.members > bank.activeMembers && <span className="cbz-muted"> (+{bank.members - bank.activeMembers} off)</span>}
                    </td>
                    <td className="cbz-muted">
                      {bank.modules.length === ALL_MODULES.length ? 'All modules' : `${bank.modules.length} of ${ALL_MODULES.length}`}
                    </td>
                    <td className="cbz-num">{fmtUsd(bank.financedExposureUsd)}</td>
                    <td className="cbz-muted">{relativeTime(bank.lastActivity)}</td>
                    <td>
                      <div className="cbz-toolbar">
                        <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--ghost" onClick={() => setManaging(bank.id)}>
                          Manage
                        </button>
                        <button
                          type="button"
                          className="cbz-btn cbz-btn--sm cbz-btn--primary"
                          disabled={bank.entities === 0}
                          title={bank.entities === 0 ? 'Add a subsidiary first' : undefined}
                          onClick={() => navigate(`/admin/banks/${bank.id}/dashboard`)}
                        >
                          Dashboard
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {banks?.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState title="No banks yet." hint="Onboard the first client bank." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showCreate && (
        <OnboardBankModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            void reload();
            setManaging(id);
          }}
        />
      )}
      {managing !== null && (
        <ManageBankModal
          bankId={managing}
          onClose={() => {
            setManaging(null);
            void reload();
          }}
        />
      )}
    </>
  );
}

function ModuleChecks({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="cbz-check-grid">
      {DASHBOARD_MODULES.map((m) => (
        <label key={m.key} className="cbz-check">
          <input
            type="checkbox"
            checked={value.includes(m.key)}
            onChange={(e) => onChange(e.target.checked ? [...value, m.key] : value.filter((k) => k !== m.key))}
          />
          {m.label}
        </label>
      ))}
    </div>
  );
}

function OnboardBankModal({ onClose, onCreated }: { onClose: () => void; onCreated: (bankId: number) => void }) {
  const [form, setForm] = useState({ name: '', country: 'Zimbabwe', email: '', phoneNumber: '', identifier: '', status: 'onboarding' as BankStatus });
  const [modules, setModules] = useState<string[]>(ALL_MODULES);
  const [withEntity, setWithEntity] = useState(true);
  const [entity, setEntity] = useState({ code: '', name: '', segment: 'Commercial banking', regulator: 'RBZ', pcafApplicable: 'A (lending)' });
  const [withAdmin, setWithAdmin] = useState(true);
  const [bankAdmin, setBankAdmin] = useState({ fullName: '', email: '', password: generateTempPassword() });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });

  async function submit() {
    setError(null);
    if (!form.name.trim() || !form.email.trim() || !form.identifier.trim()) {
      setError('Bank name, contact email and identifier are required.');
      return;
    }
    if (withEntity && (!entity.code || !entity.name.trim())) {
      setError('Give the first subsidiary a code and a name, or untick it.');
      return;
    }
    if (withEntity && withAdmin && (!bankAdmin.fullName.trim() || !bankAdmin.email.trim())) {
      setError("Enter the bank administrator's name and email, or untick it.");
      return;
    }
    setSubmitting(true);
    try {
      const bank = await adminApi.createBank({
        ...form,
        phoneNumber: form.phoneNumber || undefined,
        modules,
        ...(withEntity ? { firstEntity: entity } : {}),
        ...(withEntity && withAdmin ? { bankAdmin } : {}),
      });
      onCreated(bank.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not onboard the bank.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Onboard a bank"
      subtitle="Creates the client, its licensed modules and (optionally) its first subsidiary and admin."
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Onboard bank"
      submitting={submitting}
      error={error}
      wide
    >
      <div className="cbz-section-title">Bank profile</div>
      <div className="cbz-grid cbz-grid--form">
        <label className="cbz-field">
          <span>Bank name</span>
          <input value={form.name} onChange={set('name')} placeholder="Stanbic Bank Zimbabwe" required />
        </label>
        <label className="cbz-field">
          <span>Identifier</span>
          <input value={form.identifier} onChange={set('identifier')} placeholder="STANBIC-ZW-001" required />
        </label>
        <label className="cbz-field">
          <span>Contact email</span>
          <input type="email" value={form.email} onChange={set('email')} placeholder="esg@bank.co.zw" required />
        </label>
        <label className="cbz-field">
          <span>Phone</span>
          <input value={form.phoneNumber} onChange={set('phoneNumber')} placeholder="+263 …" />
        </label>
        <label className="cbz-field">
          <span>Country</span>
          <input value={form.country} onChange={set('country')} />
        </label>
        <label className="cbz-field">
          <span>Status</span>
          <select value={form.status} onChange={set('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cbz-section-title">Licensed dashboard modules</div>
      <ModuleChecks value={modules} onChange={setModules} />

      <label className="cbz-check cbz-section-title">
        <input type="checkbox" checked={withEntity} onChange={(e) => setWithEntity(e.target.checked)} />
        Create the first subsidiary now
      </label>
      {withEntity && (
        <div className="cbz-grid cbz-grid--form">
          <label className="cbz-field">
            <span>Code</span>
            <input value={entity.code} onChange={(e) => setEntity({ ...entity, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="STANBANK" maxLength={20} />
          </label>
          <label className="cbz-field">
            <span>Subsidiary name</span>
            <input value={entity.name} onChange={(e) => setEntity({ ...entity, name: e.target.value })} placeholder="Stanbic Bank Zimbabwe" />
          </label>
          <label className="cbz-field">
            <span>Segment</span>
            <input value={entity.segment} onChange={(e) => setEntity({ ...entity, segment: e.target.value })} />
          </label>
          <label className="cbz-field">
            <span>Regulator</span>
            <input value={entity.regulator} onChange={(e) => setEntity({ ...entity, regulator: e.target.value })} />
          </label>
          <label className="cbz-field cbz-field--wide">
            <span>PCAF applicability</span>
            <input value={entity.pcafApplicable} onChange={(e) => setEntity({ ...entity, pcafApplicable: e.target.value })} />
          </label>
        </div>
      )}

      {withEntity && (
        <>
          <label className="cbz-check cbz-section-title">
            <input type="checkbox" checked={withAdmin} onChange={(e) => setWithAdmin(e.target.checked)} />
            Create the bank's administrator account
          </label>
          {withAdmin && (
            <div className="cbz-grid cbz-grid--form">
              <label className="cbz-field">
                <span>Full name</span>
                <input value={bankAdmin.fullName} onChange={(e) => setBankAdmin({ ...bankAdmin, fullName: e.target.value })} />
              </label>
              <label className="cbz-field">
                <span>Email</span>
                <input type="email" value={bankAdmin.email} onChange={(e) => setBankAdmin({ ...bankAdmin, email: e.target.value })} />
              </label>
              <label className="cbz-field cbz-field--wide">
                <span>Temporary password (share it securely)</span>
                <input value={bankAdmin.password} onChange={(e) => setBankAdmin({ ...bankAdmin, password: e.target.value })} minLength={8} />
              </label>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function ManageBankModal({ bankId, onClose }: { bankId: number; onClose: () => void }) {
  const { data: bank, error: loadError, reload } = useLoad(() => adminApi.bank(bankId), [bankId]);
  const [draft, setDraft] = useState<{ status: BankStatus; modules: string[]; email: string; phoneNumber: string } | null>(null);
  const [entity, setEntity] = useState({ code: '', name: '', segment: '', regulator: 'RBZ', pcafApplicable: '' });
  const [message, setMessage] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (bank && !draft) {
    setDraft({ status: bank.status, modules: bank.modules, email: bank.email, phoneNumber: bank.phoneNumber ?? '' });
  }

  async function saveProfile() {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      await adminApi.updateBank(bankId, { ...draft, phoneNumber: draft.phoneNumber || undefined });
      await reload();
      setMessage({ kind: 'success', text: 'Bank updated.' });
    } catch (err) {
      setMessage({ kind: 'danger', text: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  }

  async function addEntity() {
    if (!entity.code || !entity.name.trim() || !entity.segment.trim()) {
      setMessage({ kind: 'danger', text: 'Subsidiary code, name and segment are required.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await adminApi.addEntity(bankId, entity);
      setEntity({ code: '', name: '', segment: '', regulator: 'RBZ', pcafApplicable: '' });
      await reload();
      setMessage({ kind: 'success', text: `Subsidiary ${entity.name} added.` });
    } catch (err) {
      setMessage({ kind: 'danger', text: err instanceof Error ? err.message : 'Could not add subsidiary.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={bank ? `Manage ${bank.name}` : 'Manage bank'} subtitle={bank?.identifier} onClose={onClose} wide>
      {loadError && <ErrorNote message={loadError} onRetry={reload} />}
      {!bank || !draft ? (
        <Loading />
      ) : (
        <>
          <div className="cbz-section-title">Status & contact</div>
          <div className="cbz-grid cbz-grid--form">
            <label className="cbz-field">
              <span>Status</span>
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as BankStatus })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="cbz-field">
              <span>Contact email</span>
              <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </label>
            <label className="cbz-field">
              <span>Phone</span>
              <input value={draft.phoneNumber} onChange={(e) => setDraft({ ...draft, phoneNumber: e.target.value })} />
            </label>
          </div>
          {draft.status === 'suspended' && (
            <p className="cbz-alert cbz-alert--danger">Suspended banks' users cannot sign in to their dashboard.</p>
          )}

          <div className="cbz-section-title">Licensed dashboard modules</div>
          <ModuleChecks value={draft.modules} onChange={(modules) => setDraft({ ...draft, modules })} />
          <div className="cbz-form__actions">
            <button type="button" className="cbz-btn cbz-btn--primary" onClick={saveProfile} disabled={saving}>
              Save bank settings
            </button>
          </div>

          <div className="cbz-section-title">Subsidiaries ({bank.entities.length})</div>
          <div className="cbz-table-wrap">
            <table className="cbz-table cbz-table--compact">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Segment</th>
                  <th>Regulator</th>
                  <th>PCAF</th>
                  <th className="cbz-num">Departments</th>
                </tr>
              </thead>
              <tbody>
                {bank.entities.map((e) => (
                  <tr key={e.code}>
                    <td className="cbz-mono">{e.code}</td>
                    <td>{e.name}</td>
                    <td>{e.segment}</td>
                    <td>{e.regulator}</td>
                    <td className="cbz-muted">{e.pcafApplicable || '—'}</td>
                    <td className="cbz-num">{bank.departments.filter((d) => d.entityCode === e.code).length}</td>
                  </tr>
                ))}
                {bank.entities.length === 0 && (
                  <tr>
                    <td colSpan={6} className="cbz-muted">
                      No subsidiaries yet. Add one below so the bank can start reporting.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="cbz-section-title">Add a subsidiary</div>
          <div className="cbz-grid cbz-grid--form">
            <label className="cbz-field">
              <span>Code</span>
              <input value={entity.code} onChange={(e) => setEntity({ ...entity, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="FBCBS" maxLength={20} />
            </label>
            <label className="cbz-field">
              <span>Name</span>
              <input value={entity.name} onChange={(e) => setEntity({ ...entity, name: e.target.value })} placeholder="FBC Building Society" />
            </label>
            <label className="cbz-field">
              <span>Segment</span>
              <input value={entity.segment} onChange={(e) => setEntity({ ...entity, segment: e.target.value })} placeholder="Mortgage lending" />
            </label>
            <label className="cbz-field">
              <span>Regulator</span>
              <input value={entity.regulator} onChange={(e) => setEntity({ ...entity, regulator: e.target.value })} />
            </label>
            <label className="cbz-field cbz-field--wide">
              <span>PCAF applicability</span>
              <input value={entity.pcafApplicable} onChange={(e) => setEntity({ ...entity, pcafApplicable: e.target.value })} placeholder="A (mortgages)" />
            </label>
          </div>
          <div className="cbz-form__actions">
            <button type="button" className="cbz-btn cbz-btn--ghost" onClick={addEntity} disabled={saving}>
              + Add subsidiary
            </button>
          </div>
          {message && <p className={`cbz-alert cbz-alert--${message.kind}`}>{message.text}</p>}
        </>
      )}
    </Modal>
  );
}
