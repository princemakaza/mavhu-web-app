import type {
  AuditEntry,
  BankEntity,
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
  RiskEntry,
  WorkforceRecord,
} from './types';

const CBZ_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3004/api/v1'}/cbz`;
const TOKEN_KEY = 'cbz_token';

async function cbzFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${CBZ_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || response.statusText);
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
