import { apiFetch } from './client';
import type { ExternalMailboxConnection } from '../types/api';

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

export function deleteMailboxConnection(id: string): Promise<void> {
  return apiFetch<void>(`/mailbox-connections/${id}`, { method: 'DELETE' });
}

export function retryMailboxConnection(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/mailbox-connections/${id}/retry`, { method: 'PATCH' });
}
