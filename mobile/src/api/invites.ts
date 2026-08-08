import { apiFetch } from './client';
import { appendFilePart } from '../lib/formData';
import type { AuthResponse, InviteResolveResponse, InviteVerifyCodeResponse } from '../types/api';

// Flux public d'activation (aucun token requis) — 3 étapes indépendantes,
// miroir de src/routes/publicUserInvites.ts.
export async function resolveInviteFile(file: {
  uri: string;
  name: string;
  mimeType: string | null;
}): Promise<InviteResolveResponse> {
  const form = new FormData();
  await appendFilePart(form, 'file', file);
  return apiFetch<InviteResolveResponse>('/public/user-invites/resolve', { method: 'POST', body: form });
}

// Lien reçu par email (routes/userInvites.ts::sendInviteEmail) ou deep link natif
// une fois les App/Universal Links configurés — saute l'étape d'upload du fichier.
export function resolveInviteByToken(token: string): Promise<InviteResolveResponse> {
  return apiFetch<InviteResolveResponse>(`/public/user-invites/resolve-by-token?token=${encodeURIComponent(token)}`);
}

export function verifyInviteCode(fileToken: string, code: string): Promise<InviteVerifyCodeResponse> {
  return apiFetch<InviteVerifyCodeResponse>('/public/user-invites/verify-code', {
    method: 'POST',
    body: { fileToken, code },
  });
}

export function activateInvite(
  fileToken: string,
  activationToken: string,
  password: string
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/public/user-invites/activate', {
    method: 'POST',
    body: { fileToken, activationToken, password },
  });
}
