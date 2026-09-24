import type { CbzSession } from './types';

const KEY = 'cbz.dashboard.session.v1';

export const cbzSession = {
  load(): CbzSession | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CbzSession;
    } catch {
      return null;
    }
  },
  save(session: CbzSession): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      // storage unavailable; session lives for this tab only
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // nothing to clear
    }
  },
};
