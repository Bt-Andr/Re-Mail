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

// Échange le jeton d'échange à usage unique posé par GET .../gmail/callback (intent
// 'signin') contre une vraie session — voir (auth)/login.tsx, (auth)/signup.tsx,
// (auth)/welcome.tsx et google-callback.tsx. Même forme de réponse que signup()
// (organization à part). skipAuthRedirect : endpoint public, un 401 ici signifie un
// jeton d'échange expiré/déjà consommé (ex. double interception concurrente du même
// retour Google sur Android), jamais une session ambiante à invalider.
export function exchangeGoogleHandoff(handoff: string): Promise<AuthResponse & { organization: Organization }> {
  return apiFetch<AuthResponse & { organization: Organization }>('/auth/google/exchange', {
    method: 'POST',
    body: { handoff },
    skipAuthRedirect: true,
  });
}
