import { apiFetch } from './client';
import { API_URL } from '../lib/config';
import { getToken } from '../lib/session';
import type { OrgRole, UserInvite } from '../types/api';

export interface CreateInviteValues {
  nom: string;
  username: string;
  email: string;
  orgRole: OrgRole;
}

export function listInvites(): Promise<UserInvite[]> {
  return apiFetch<UserInvite[]>('/user-invites');
}

export function createInvite(values: CreateInviteValues): Promise<UserInvite> {
  return apiFetch<UserInvite>('/user-invites', { method: 'POST', body: values });
}

export function generateActivationCode(id: string): Promise<{ code: string; expiresAt: string }> {
  return apiFetch<{ code: string; expiresAt: string }>(`/user-invites/${id}/activation-code`, { method: 'POST' });
}

export function revokeInvite(id: string): Promise<UserInvite> {
  return apiFetch<UserInvite>(`/user-invites/${id}/revoke`, { method: 'POST' });
}

// Le fichier est un blob chiffré opaque (pas du JSON) — on ne peut pas passer
// par apiFetch (qui suppose une réponse JSON). Renvoie l'URI local temporaire
// du fichier téléchargé, prêt à être partagé via expo-sharing.
export async function downloadInviteFile(id: string, filename: string): Promise<string> {
  const { fetch: expoFetch } = await import('expo/fetch');
  const { File, Paths } = await import('expo-file-system');
  const token = await getToken();

  const res = await expoFetch(`${API_URL}/user-invites/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Téléchargement impossible.');

  const file = new File(Paths.cache, filename);
  file.write(new Uint8Array(await res.arrayBuffer()));
  return file.uri;
}
