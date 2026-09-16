import { apiFetch } from './client';
import type { AuthResponse, User } from '../types/api';

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

export function signup(payload: SignupPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/signup', { method: 'POST', body: payload });
}

export function me(): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/auth/me');
}

export function requestPasswordReset(username: string): Promise<{ ok: true; message: string }> {
  return apiFetch('/auth/password-reset/request', {
    method: 'POST',
    body: { username },
    skipAuthRedirect: true,
  });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: true; token: string }> {
  return apiFetch('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
}

// Échange le jeton d'échange à usage unique posé par GET .../gmail/callback (intent
// 'signin') contre une vraie session — voir (auth)/login.tsx, (auth)/signup.tsx,
// (auth)/welcome.tsx et google-callback.tsx. skipAuthRedirect : endpoint public, un 401
// ici signifie un jeton d'échange expiré/déjà consommé (ex. double interception
// concurrente du même retour Google sur Android), jamais une session ambiante à invalider.
export function exchangeGoogleHandoff(handoff: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/google/exchange', {
    method: 'POST',
    body: { handoff },
    skipAuthRedirect: true,
  });
}
