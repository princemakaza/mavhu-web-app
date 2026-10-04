import type { AdminSession } from './types';

const KEY = 'mavhu.admin.session';

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export const adminSessionStore = {
  load(): AdminSession | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as AdminSession;
      if (isExpired(session.token)) {
        localStorage.removeItem(KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },
  save(session: AdminSession): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      /* storage unavailable: session lasts for this tab only */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  },
};
