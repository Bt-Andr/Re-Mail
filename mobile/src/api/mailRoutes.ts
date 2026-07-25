import { apiFetch } from './client';
import type { MailRoute } from '../types/api';

export interface MailRouteFormValues {
  alias: string;
  personalEmail: string;
  displayName: string;
}

export function listMailRoutes(): Promise<MailRoute[]> {
  return apiFetch<MailRoute[]>('/mail-routes');
}

export function createMailRoute(values: MailRouteFormValues): Promise<MailRoute> {
  return apiFetch<MailRoute>('/mail-routes', { method: 'POST', body: values });
}

export function updateMailRoute(id: string, values: Partial<MailRouteFormValues & { active: boolean }>): Promise<MailRoute> {
  return apiFetch<MailRoute>(`/mail-routes/${id}`, { method: 'PUT', body: values });
}

export function deleteMailRoute(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/mail-routes/${id}`, { method: 'DELETE' });
}
