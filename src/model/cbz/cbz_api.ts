import type {
  AuditEntry,
  BankEntity,
  BankInfo,
  ChainVerification,
  DisclosureRow,
  DisclosureVersion,
  EvidenceFile,
  Me,
  MrvBorrower,
  RegisterDef,
  RegisterItem,
  Counterparty,
  Department,
  EmissionRecord,
  FinancedPosition,
  FinancialInclusionRecord,
  GeospatialRecord,
  Incident,
  IngestionBatch,
  InsurancePolicy,
  Member,
  ReportingPeriod,
  RiskEntry,
  WorkforceRecord,
} from './types';

const CBZ_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3004/api/v1'}/cbz`;
const TOKEN_KEY = 'cbz_token';

/**
 * When a MAvHU admin opens a bank's dashboard from the admin console, every request is sent
 * with the admin's token and ?bankId= instead of the bank member's own token.
 */
let adminView: { token: string; bankId: number } | null = null;

export function setCbzAdminView(view: { token: string; bankId: number } | null): void {
  adminView = view;
}

/** True when a request would carry credentials. Without them the API returns no bank data at all. */
export function hasCbzCredentials(): boolean {
  return Boolean(adminView?.token ?? localStorage.getItem(TOKEN_KEY));
}

let onUnauthorized: (() => void) | null = null;

/** The bank portal registers this so an expired token or deactivated account returns to sign-in. */
export function setCbzUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function withBankId(path: string): string {
  if (!adminView) return path;
  return `${path}${path.includes('?') ? '&' : '?'}bankId=${adminView.bankId}`;
}

async function cbzFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = adminView?.token ?? localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${CBZ_BASE}${withBankId(path)}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.();
    const body = await response.json().catch(() => null);
    const message = (body as { message?: string | string[] } | null)?.message;
    throw new Error((Array.isArray(message) ? message.join('. ') : message) || response.statusText);
  }
  return response.json() as Promise<T>;
}

// ── Auth ────────────────────────────────────────────────────────────────────
export async function cbzApiLogin(email: string, password: string): Promise<{ member: Omit<Member, 'passwordHash'>; token: string }> {
  const result = await cbzFetch<{ member: Omit<Member, 'passwordHash'>; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem(TOKEN_KEY, result.token);
  return result;
}

export function cbzApiLogout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Reads ───────────────────────────────────────────────────────────────────
export const fetchBank = () => cbzFetch<BankInfo>('/bank');
export const fetchPeriods = () => cbzFetch<ReportingPeriod[]>('/periods');
export const fetchEntities = () => cbzFetch<BankEntity[]>('/entities');
export const fetchDepartments = () => cbzFetch<Department[]>('/departments');
export const fetchMembers = () => cbzFetch<Member[]>('/members');
export const fetchCounterparties = () => cbzFetch<Counterparty[]>('/counterparties');
export const fetchFinancedPositions = () => cbzFetch<FinancedPosition[]>('/financed-positions');
export const fetchEmissions = () => cbzFetch<EmissionRecord[]>('/emissions');
export const fetchInsurance = () => cbzFetch<InsurancePolicy[]>('/insurance');
export const fetchFinancialInclusion = () => cbzFetch<FinancialInclusionRecord[]>('/financial-inclusion');
export const fetchWorkforce = () => cbzFetch<WorkforceRecord[]>('/workforce');
export const fetchIncidents = () => cbzFetch<Incident[]>('/incidents');
export const fetchRisks = () => cbzFetch<RiskEntry[]>('/risks');
export const fetchGeospatial = () => cbzFetch<GeospatialRecord[]>('/geospatial');
export const fetchIngestion = () => cbzFetch<IngestionBatch[]>('/ingestion');
export const fetchAudit = () => cbzFetch<AuditEntry[]>('/audit');

// ── Mutations ───────────────────────────────────────────────────────────────
export const apiAddCounterparty = (body: Partial<Counterparty>) =>
  cbzFetch<Counterparty>('/counterparties', { method: 'POST', body: JSON.stringify(body) });

export const apiAddFinancedPosition = (body: Partial<FinancedPosition>) =>
  cbzFetch<FinancedPosition>('/financed-positions', { method: 'POST', body: JSON.stringify(body) });

export const apiAddEmission = (body: Partial<EmissionRecord>) =>
  cbzFetch<EmissionRecord>('/emissions', { method: 'POST', body: JSON.stringify(body) });

export const apiAdvanceEmission = (id: string, actorId?: string) =>
  cbzFetch<EmissionRecord>(`/emissions/${id}/advance`, { method: 'PATCH', body: JSON.stringify({ actorId }) });

export const apiAddInsurance = (body: Partial<InsurancePolicy>) =>
  cbzFetch<InsurancePolicy>('/insurance', { method: 'POST', body: JSON.stringify(body) });

export const apiAddIncident = (body: Partial<Incident>) =>
  cbzFetch<Incident>('/incidents', { method: 'POST', body: JSON.stringify(body) });

export const apiAddRisk = (body: Partial<RiskEntry>) =>
  cbzFetch<RiskEntry>('/risks', { method: 'POST', body: JSON.stringify(body) });

export const apiAddIngestionBatch = (body: Partial<IngestionBatch>) =>
  cbzFetch<IngestionBatch>('/ingestion', { method: 'POST', body: JSON.stringify(body) });

export const apiAppendAudit = (body: Partial<AuditEntry>) =>
  cbzFetch<AuditEntry>('/audit', { method: 'POST', body: JSON.stringify(body) });

export const apiAddDepartment = (body: Partial<Department>) =>
  cbzFetch<Department>('/departments', { method: 'POST', body: JSON.stringify(body) });

export const apiAddMember = (body: Partial<Member> & { password?: string }) =>
  cbzFetch<Member>('/members', { method: 'POST', body: JSON.stringify(body) });

// ── Bulk import (Excel / CSV) ───────────────────────────────────────────────
export interface ImportIssue {
  row: number;
  column?: string;
  code: string;
  message: string;
}

export interface ImportSheetResult {
  sheet: string;
  dataset: string | null;
  label: string;
  status: 'ready' | 'imported' | 'partial' | 'failed' | 'skipped' | 'empty';
  reason?: string;
  notes: string[];
  totalRows: number;
  validRows: number;
  toCreate: number;
  toUpdate: number;
  rejected: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  batchId?: string;
}

export interface ImportResult {
  fileName: string;
  bankName: string;
  dryRun: boolean;
  sheets: ImportSheetResult[];
  totals: { rows: number; valid: number; created: number; updated: number; rejected: number };
}

export interface ImportDatasets {
  datasets: Array<{ key: string; sheet: string; label: string; columns: Array<{ header: string; required: boolean }> }>;
  notImported: Array<{ sheet: string; reason: string }>;
}

/** Multipart requests carry their own content type, so they bypass cbzFetch's JSON header. */
async function cbzRaw(path: string, init: RequestInit): Promise<Response> {
  const token = adminView?.token ?? localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${CBZ_BASE}${withBankId(path)}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
    const body = await response.json().catch(() => null);
    const message = (body as { message?: string | string[] } | null)?.message;
    throw new Error((Array.isArray(message) ? message.join('. ') : message) || response.statusText);
  }
  return response;
}

export async function apiImportFile(file: File, options: { dryRun: boolean; period?: string }): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  if (options.period) form.append('period', options.period);
  const response = await cbzRaw(`/import${options.dryRun ? '?dryRun=true' : ''}`, { method: 'POST', body: form });
  return response.json() as Promise<ImportResult>;
}

export const fetchImportDatasets = () => cbzFetch<ImportDatasets>('/import/datasets');

/** Downloads the signed-in bank's Excel template (its own subsidiary codes in the drop-downs). */
export async function downloadImportTemplate(): Promise<void> {
  const response = await cbzRaw('/import/template', { method: 'GET' });
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'ESG_import_template.xlsx';
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Role, workflow and register actions ─────────────────────────────────────
export const fetchMe = () => cbzFetch<Me>('/me');
export const fetchMrv = () => cbzFetch<MrvBorrower[]>('/mrv');
export const fetchAuditVerification = () => cbzFetch<ChainVerification>('/audit/verify');

export const apiRejectEmission = (id: string, reason: string) =>
  cbzFetch<EmissionRecord>(`/emissions/${encodeURIComponent(id)}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) });

export const apiTagCounterparty = (id: string, body: { taxonomy: string | null; taxonomyCategory?: string | null; taxonomyStatus?: string | null }) =>
  cbzFetch<Counterparty>(`/counterparties/${encodeURIComponent(id)}/taxonomy`, { method: 'PATCH', body: JSON.stringify(body) });

export const apiUpdateIncident = (id: string, body: { status?: string; correctiveAction?: string; closureDate?: string | null }) =>
  cbzFetch<Incident>(`/incidents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });

export const apiUpdateRisk = (id: string, body: { likelihood?: number; impact?: number; status?: string; owner?: string }) =>
  cbzFetch<RiskEntry>(`/risks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });

export const fetchRegisterDefs = () => cbzFetch<RegisterDef[]>('/registers');
export const fetchRegister = (register: string) => cbzFetch<RegisterItem[]>(`/registers/${register}`);
export const apiCreateRegisterItem = (register: string, body: { entityCode?: string | null; data: Record<string, unknown> }) =>
  cbzFetch<RegisterItem>(`/registers/${register}`, { method: 'POST', body: JSON.stringify(body) });
export const apiUpdateRegisterItem = (register: string, id: string, body: { entityCode?: string | null; data: Record<string, unknown> }) =>
  cbzFetch<RegisterItem>(`/registers/${register}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDeleteRegisterItem = (register: string, id: string) =>
  cbzFetch<{ id: string }>(`/registers/${register}/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ── Evidence ────────────────────────────────────────────────────────────────
export const fetchEvidence = (filter: { targetType?: string; targetId?: string } = {}) => {
  const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as Array<[string, string]>).toString();
  return cbzFetch<EvidenceFile[]>(`/evidence${q ? `?${q}` : ''}`);
};

export async function apiUploadEvidence(file: File, meta: { targetType: string; targetId?: string; entityCode?: string; description?: string }): Promise<EvidenceFile> {
  const form = new FormData();
  form.append('file', file);
  for (const [k, v] of Object.entries(meta)) if (v) form.append(k, v);
  const response = await cbzRaw('/evidence', { method: 'POST', body: form });
  return response.json() as Promise<EvidenceFile>;
}

async function saveResponse(response: Response, fallback: string) {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallback;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadEvidence(file: EvidenceFile): Promise<void> {
  await saveResponse(await cbzRaw(`/evidence/${encodeURIComponent(file.id)}/download`, { method: 'GET' }), file.fileName);
}

// ── Disclosures ─────────────────────────────────────────────────────────────
export const fetchDisclosures = () => cbzFetch<DisclosureVersion[]>('/disclosures');
export const fetchDisclosure = (id: string) => cbzFetch<DisclosureVersion>(`/disclosures/${encodeURIComponent(id)}`);
export const apiPublishDisclosure = (body: { framework: string; period: string; title?: string; notes?: string; rows: DisclosureRow[] }) =>
  cbzFetch<DisclosureVersion>('/disclosures', { method: 'POST', body: JSON.stringify(body) });

export async function downloadDisclosure(d: DisclosureVersion, format: 'xlsx' | 'csv' | 'doc' | 'json'): Promise<void> {
  await saveResponse(await cbzRaw(`/disclosures/${encodeURIComponent(d.id)}/export?format=${format}`, { method: 'GET' }), `${d.framework}_${d.period}_v${d.version}.${format}`);
}
