import { apiFetch } from './client';
import type { AuthResponse, User } from '../types/api';

export function login(username: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { username, password } });
}

export function me(): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/auth/me');
}
