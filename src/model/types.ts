import type { RoleKey } from './roles';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  customerId: number;
  estateId: number | null;
  roles: string[];
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: AuthUser;
}

export interface Session {
  token: string;
  user: AuthUser;
  activeRole: RoleKey;
  organizationName: string | null;
}

export interface Organization {
  id: number;
  name: string;
  identifier: 'BANK' | 'AGROBUSINESS' | 'PLATFORM';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  customerId: number;
  roleNames: string[];
}
