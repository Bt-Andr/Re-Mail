import { apiFetch } from './client';
import type { OrgSummary } from '../types/api';

export function getOrgSummary(): Promise<OrgSummary> {
  return apiFetch<OrgSummary>('/organizations/me');
}

// Trois étapes du même flux Resend que web (features/onboarding/steps/*.tsx) — jamais
// exposées sur mobile avant (onboarding toujours web-only), maintenant accessibles
// depuis le picker "ajouter un compte" (voir ResendConnectSheet).
export function connectResend(apiKey: string): Promise<{ verifiedDomains: string[] }> {
  return apiFetch<{ verifiedDomains: string[] }>('/organizations/me/resend/connect', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export function selectResendDomain(domain: string): Promise<unknown> {
  return apiFetch('/organizations/me/resend/select-domain', { method: 'POST', body: JSON.stringify({ domain }) });
}

export function setResendWebhookSecret(webhookSecret: string): Promise<unknown> {
  return apiFetch('/organizations/me/resend/webhook-secret', { method: 'POST', body: JSON.stringify({ webhookSecret }) });
}
