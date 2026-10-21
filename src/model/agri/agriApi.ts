// Agri MRV portal API: a farm's own users, or MAvHU staff viewing a farm read-only (?customerId=).

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3004/api/v1';

export interface AgriMe {
  name: string;
  email: string;
  roles: string[];
  canWrite: boolean;
  canApprove: boolean;
  viewer: boolean;
  customer: { id: number; name: string; country: string; hectares: number };
  financedBy: Array<{ bank: string; reference: string }>;
}

export interface Estate {
  id: number;
  name: string;
  hectares: number;
  country: string;
  latestPass: string | null;
  ndvi: number | null;
  ndviYearAgo: number | null;
  carbonStockTco2: number | null;
  carbonChangeTco2: number | null;
  cropCycles: number;
  lastVisit: string | null;
}

export interface SatellitePoint {
  estateId: number;
  date: string;
  ndviMean: number;
  ndviMin: number;
  ndviMax: number;
  ndwiMean: number;
  biomassCo2: number;
  soilCo2: number;
  netCo2Stock: number;
}

export interface CropCycle {
  id: number;
  estateId: number;
  estate: string;
  name: string;
  startDate: string;
  endDate: string;
  recordedBy: string | null;
}

export interface EmissionFactor {
  id: number;
  name: string;
  component: string;
  factor: number;
  gwp: number;
  unit: string;
  description: string | null;
}

export interface FarmEmission {
  id: number;
  estateId: number;
  estate: string;
  cropCycle: string | null;
  factor: string;
  unit: string;
  quantity: number;
  tonCo2e: number;
  scope: number;
  approved: boolean;
  createdBy: string | null;
  approvedBy: string | null;
  startDate: string;
  endDate: string;
  note: string | null;
  auditTrail: string | null;
}

export interface FieldVisit {
  id: number;
  estateId: number;
  estate: string;
  visitDate: string;
  officer: string;
  method: string;
  findings: string;
  ndviConfirmed: boolean;
  status: 'Submitted' | 'Verified' | 'Disputed';
}

export function createAgriApi(token: string, viewAsCustomerId?: number, onUnauthorized?: () => void) {
  const q = viewAsCustomerId ? `customerId=${viewAsCustomerId}` : '';
  async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const url = `${BASE}/agri${path}${q ? `${path.includes('?') ? '&' : '?'}${q}` : ''}`;
    const response = await fetch(url, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) onUnauthorized?.();
      const message = (body as { message?: string | string[] } | null)?.message;
      throw new Error((Array.isArray(message) ? message.join('. ') : message) ?? 'Request failed');
    }
    return body as T;
  }
  return {
    me: () => request<AgriMe>('/me'),
    estates: () => request<Estate[]>('/estates'),
    satellite: (estateId?: number) => request<SatellitePoint[]>(`/satellite${estateId ? `?estateId=${estateId}` : ''}`),
    cropCycles: () => request<CropCycle[]>('/crop-cycles'),
    addCropCycle: (body: { estateId: number; name: string; startDate: string; endDate: string }) => request<{ id: number }>('/crop-cycles', { method: 'POST', body }),
    factors: () => request<EmissionFactor[]>('/emission-factors'),
    emissions: () => request<FarmEmission[]>('/emissions'),
    addEmission: (body: { estateId: number; cropCycleId?: number | null; emissionFactorId: number; quantity: number; scope: number; startDate: string; endDate: string; note?: string }) =>
      request<{ id: number; tonCo2e: number }>('/emissions', { method: 'POST', body }),
    approveEmission: (id: number) => request<{ id: number }>(`/emissions/${id}/approve`, { method: 'PATCH' }),
    visits: () => request<FieldVisit[]>('/verifications'),
    addVisit: (body: { estateId: number; visitDate: string; officer: string; method: string; findings: string; ndviConfirmed: boolean }) =>
      request<{ id: number }>('/verifications', { method: 'POST', body }),
    reviewVisit: (id: number, status: 'Verified' | 'Disputed') => request<{ id: number }>(`/verifications/${id}`, { method: 'PATCH', body: { status } }),
  };
}

export type AgriApi = ReturnType<typeof createAgriApi>;

// ── Session (farm users) ──────────────────────────────────────────────────────

export interface AgriSession {
  token: string;
  name: string;
  email: string;
}

const KEY = 'mavhu.agri.session';

export const agriSessionStore = {
  load(): AgriSession | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as AgriSession;
      const payload = JSON.parse(atob(s.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem(KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  },
  save(s: AgriSession) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* session lasts for this tab only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

/** Farm sign-in: only agribusiness ESG users; everyone else is pointed at their own portal. */
export async function agriLogin(email: string, password: string): Promise<AgriSession> {
  const response = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 401 ? 'Incorrect email or password.' : (body?.message ?? 'Sign-in failed'));
  const user = body.user as { name: string; email: string; roles: string[]; orgType: string | null };
  if (user.orgType === 'PLATFORM') throw new Error('MAvHU staff: use the MAvHU console, where any farm can be opened read-only.');
  if (user.orgType === 'BANK') throw new Error('Bank staff: sign in on the bank portal.');
  if (!user.roles.some((r) => ['ESG_READER', 'ESG_CONTRIBUTOR', 'ESG_APPROVER'].includes(r))) throw new Error('This account has no Agri MRV role.');
  return { token: body.accessToken as string, name: user.name, email: user.email };
}
