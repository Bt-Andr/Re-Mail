import { apiFetch } from './client';
import type { AuthResponse, Organization, User } from '../types/api';

export function login(username: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { username, password } });
}

export interface SignupPayload {
  accountType: 'pro' | 'perso';
  orgName?: string;
  nom: string;
  username: string;
  email: string;
  password: string;
}

// Contrairement à /auth/login (organization absente du user tant que /auth/me n'a pas
// été rappelé), /auth/signup renvoie organization à part — à fusionner dans user avant
// login() pour que useAccountContext (isPersonal) soit juste dès l'écran suivant.
export function signup(payload: SignupPayload): Promise<AuthResponse & { organization: Organization }> {
  return apiFetch<AuthResponse & { organization: Organization }>('/auth/signup', { method: 'POST', body: payload });
}

export function me(): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/auth/me');
}
