import { adminSessionStore } from './adminSession';
import type {
  AdminMember,
  AdminSession,
  AuditRow,
  BankDetail,
  BankStats,
  MemberRole,
  Overview,
  PeriodRow,
  TeamMember,
  TeamRole,
} from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3004/api/v1';

let onUnauthorized: (() => void) | null = null;

/** The admin app registers this so an expired or revoked token sends the user back to sign-in. */
export function setAdminUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const token = init.token ?? adminSessionStore.load()?.token;
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the MAvHU server. Check your connection and try again.');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') onUnauthorized?.();
    const message = (body as { message?: string | string[] } | null)?.message;
    throw new Error((Array.isArray(message) ? message.join('. ') : message) ?? 'Something went wrong. Please try again.');
  }
  return body as T;
}

const json = (method: string, body: unknown) => ({ method, body });

export const adminApi = {
  /** Platform login; only accounts holding MAVHU_ADMIN may enter the console. */
  async login(email: string, password: string): Promise<AdminSession> {
    const auth = await request<{ accessToken: string; user: { id: number; name: string; email: string; roles: string[] } }>(
      '/auth/login',
      json('POST', { email, password }),
    );
    if (!auth.user.roles.includes('MAVHU_ADMIN')) {
      throw new Error('This account is not a MAvHU administrator.');
    }
    return { token: auth.accessToken, userId: auth.user.id, name: auth.user.name, email: auth.user.email };
  },

  overview: () => request<Overview>('/admin/overview'),
  banks: () => request<BankStats[]>('/admin/banks'),
  bank: (id: number) => request<BankDetail>(`/admin/banks/${id}`),
  createBank: (body: Record<string, unknown>) => request<BankDetail>('/admin/banks', json('POST', body)),
  updateBank: (id: number, body: Record<string, unknown>) => request<BankDetail>(`/admin/banks/${id}`, json('PATCH', body)),
  addEntity: (bankId: number, body: Record<string, unknown>) => request<unknown>(`/admin/banks/${bankId}/entities`, json('POST', body)),

  members: (bankId?: number) => request<AdminMember[]>(`/admin/members${bankId ? `?bankId=${bankId}` : ''}`),
  createMember: (body: { fullName: string; email: string; phone?: string; entityCode: string; departmentId?: string | null; role: MemberRole; password: string }) =>
    request<AdminMember>('/admin/members', json('POST', body)),
  updateMember: (id: string, body: Partial<{ role: MemberRole; entityCode: string; departmentId: string | null; isActive: boolean }>) =>
    request<AdminMember>(`/admin/members/${encodeURIComponent(id)}`, json('PATCH', body)),
  resetPassword: (id: string, password: string) =>
    request<unknown>(`/admin/members/${encodeURIComponent(id)}/reset-password`, json('POST', { password })),

  team: () => request<TeamMember[]>('/admin/team'),
  createTeamMember: (body: { name: string; email: string; password: string; roles: TeamRole[] }) =>
    request<TeamMember>('/admin/team', json('POST', body)),
  updateTeamMember: (id: number, body: Partial<{ roles: TeamRole[]; isActive: boolean }>) =>
    request<TeamMember>(`/admin/team/${id}`, json('PATCH', body)),

  periods: (bankId?: number) => request<PeriodRow[]>(`/admin/periods${bankId ? `?bankId=${bankId}` : ''}`),
  setPeriod: (body: { bankId: number; period: string; status: 'open' | 'locked' }) => request<PeriodRow>('/admin/periods', json('POST', body)),

  audit: (bankId?: number, limit = 500) => request<AuditRow[]>(`/admin/audit?limit=${limit}${bankId ? `&bankId=${bankId}` : ''}`),
};

/** A readable temporary password for new accounts, shown to the admin to pass on. */
export function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `Mv-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}
