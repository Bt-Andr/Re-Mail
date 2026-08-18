import { apiFetch } from './client';
import type { AuthResponse, ExternalMailboxConnection, Organization } from '../types/api';

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
