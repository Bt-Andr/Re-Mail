import { apiFetch } from './client';
import type { AuthResponse, ExternalMailboxConnection, Organization, ProAddress } from '../types/api';

export interface MailboxConnectionFormValues {
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  password: string;
}

export function listMailboxConnections(): Promise<ExternalMailboxConnection[]> {
  return apiFetch<ExternalMailboxConnection[]>('/mailbox-connections');
}

export function createMailboxConnection(values: MailboxConnectionFormValues): Promise<ExternalMailboxConnection> {
  return apiFetch<ExternalMailboxConnection>('/mailbox-connections', { method: 'POST', body: values });
}

// Pas de session requise — crée un compte perso à la volée si l'email est inconnu et
// renvoie directement une session, comme signup()/exchangeGoogleHandoff() (voir
// src/routes/mailboxConnections.ts POST /imap/signin côté backend).
export function signinMailbox(values: MailboxConnectionFormValues): Promise<AuthResponse & { organization: Organization }> {
  return apiFetch<AuthResponse & { organization: Organization }>('/mailbox-connections/imap/signin', { method: 'POST', body: values });
}

export function deleteMailboxConnection(id: string): Promise<void> {
  return apiFetch<void>(`/mailbox-connections/${id}`, { method: 'DELETE' });
}

export function retryMailboxConnection(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/mailbox-connections/${id}/retry`, { method: 'PATCH' });
}

// Action ponctuelle et bornée (30 jours) — voir src/jobs/mailboxPoller.ts::importMailboxHistory
// côté backend, refusée une fois déjà faite pour cette connexion (historyImportedAt).
export function importMailboxHistory(id: string, days = 30): Promise<{ imported: number }> {
  return apiFetch<{ imported: number }>(`/mailbox-connections/${id}/import-history`, { method: 'POST', body: { days } });
}

export function listProAddresses(): Promise<ProAddress[]> {
  return apiFetch<ProAddress[]>('/pro-addresses/mine');
}

export function claimProAddress(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/pro-addresses/${id}/claim`, { method: 'POST' });
}
