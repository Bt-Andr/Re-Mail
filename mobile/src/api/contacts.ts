import { apiFetch } from './client';
import type { Contact } from '../types/api';

export function listContacts(q: string): Promise<Contact[]> {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  return apiFetch<Contact[]>(`/contacts?${query.toString()}`);
}
