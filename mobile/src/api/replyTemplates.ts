import { apiFetch } from './client';
import type { ReplyTemplate } from '../types/api';

export interface ReplyTemplateFormValues {
  titre: string;
  corps: string;
  canal?: string;
}

export function listReplyTemplates(canal?: string): Promise<ReplyTemplate[]> {
  const query = canal ? `?canal=${encodeURIComponent(canal)}` : '';
  return apiFetch<ReplyTemplate[]>(`/reply-templates${query}`);
}

export function createReplyTemplate(values: ReplyTemplateFormValues): Promise<ReplyTemplate> {
  return apiFetch<ReplyTemplate>('/reply-templates', { method: 'POST', body: values });
}

export function updateReplyTemplate(id: string, values: ReplyTemplateFormValues): Promise<ReplyTemplate> {
  return apiFetch<ReplyTemplate>(`/reply-templates/${id}`, { method: 'PUT', body: values });
}

export function deleteReplyTemplate(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/reply-templates/${id}`, { method: 'DELETE' });
}
