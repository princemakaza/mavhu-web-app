import type { AuthResponse, LoginPayload, RegisterPayload } from '../types';
import { request } from './httpClient';

export const authService = {
  login: (payload: LoginPayload) => request<AuthResponse>('/auth/login', { method: 'POST', body: payload }),
  register: (payload: RegisterPayload) => request<AuthResponse>('/auth/register', { method: 'POST', body: payload }),
};
