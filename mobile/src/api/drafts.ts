import { apiFetch } from './client';
import type { MailDraft } from '../types/api';

export interface DraftFormValues {
  toEmail?: string;
  ccEmail?: string;
  bccEmail?: string;
  subject?: string;
  body?: string;
}

export function listDrafts(): Promise<MailDraft[]> {
  return apiFetch<MailDraft[]>('/drafts');
}

export function createDraft(values: DraftFormValues): Promise<MailDraft> {
  return apiFetch<MailDraft>('/drafts', { method: 'POST', body: values });
}

export function updateDraft(id: string, values: DraftFormValues): Promise<MailDraft> {
  return apiFetch<MailDraft>(`/drafts/${id}`, { method: 'PUT', body: values });
}

export function deleteDraft(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/drafts/${id}`, { method: 'DELETE' });
}
