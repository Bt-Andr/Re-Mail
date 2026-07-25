import { apiFetch } from './client';
import type { AuthResponse, InviteResolveResponse, InviteVerifyCodeResponse } from '../types/api';

// Flux public d'activation (aucun token requis) — 3 étapes indépendantes,
// miroir de src/routes/publicUserInvites.ts.
export function resolveInviteFile(file: {
  uri: string;
  name: string;
  mimeType: string | null;
}): Promise<InviteResolveResponse> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);
  return apiFetch<InviteResolveResponse>('/public/user-invites/resolve', { method: 'POST', body: form });
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
