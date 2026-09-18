import { apiFetch } from './client';
import type { OrgSummary, ResendDomainStatus, RoundTripTestStatus, WebhookTestStatus } from '../types/api';

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

export function listVerifiedResendDomains(): Promise<{ verifiedDomains: string[] }> {
  return apiFetch<{ verifiedDomains: string[] }>('/organizations/me/resend/domains');
}

export function getResendDomainStatus(): Promise<ResendDomainStatus> {
  return apiFetch<ResendDomainStatus>('/organizations/me/resend/domain-status');
}

export function getWebhookTestStatus(): Promise<WebhookTestStatus> {
  return apiFetch<WebhookTestStatus>('/organizations/me/resend/webhook-test');
}

export function startWebhookTest(): Promise<WebhookTestStatus> {
  return apiFetch<WebhookTestStatus>('/organizations/me/resend/webhook-test/start', { method: 'POST' });
}

export function getRoundTripTestStatus(): Promise<RoundTripTestStatus> {
  return apiFetch<RoundTripTestStatus>('/organizations/me/resend/round-trip-test');
}

export function startRoundTripTest(): Promise<RoundTripTestStatus> {
  return apiFetch<RoundTripTestStatus>('/organizations/me/resend/round-trip-test/start', { method: 'POST' });
}

export function selectResendDomain(domain: string): Promise<unknown> {
  return apiFetch('/organizations/me/resend/select-domain', { method: 'POST', body: JSON.stringify({ domain }) });
}

export function setResendWebhookSecret(webhookSecret: string): Promise<unknown> {
  return apiFetch('/organizations/me/resend/webhook-secret', { method: 'POST', body: JSON.stringify({ webhookSecret }) });
}
