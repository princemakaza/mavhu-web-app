import type { Organization } from '../types';
import { request } from './httpClient';

interface Page<T> {
  data: T[];
}

export const organizationService = {
  /** Client organisations a new user can join — the Mavhu platform organisation itself is excluded. */
  async listJoinable(): Promise<Organization[]> {
    const page = await request<Page<Organization>>('/customers?limit=100&sortBy=name');
    return page.data.filter((org) => org.identifier !== 'PLATFORM');
  },

  async getName(id: number): Promise<string | null> {
    try {
      return (await request<Organization>(`/customers/${id}`)).name;
    } catch {
      return null;
    }
  },
};
