import { apiFetch } from './client';
import type { Thread, ThreadActivity, ThreadDetail, ThreadFolder, ThreadStatus } from '../types/api';

export interface ThreadListParams {
  folder: ThreadFolder;
  status?: ThreadStatus;
  canal?: string;
  q?: string;
  account?: string; // ExternalMailboxConnection.id, ou le sentinel 'resend' — voir AccountSwitcherContext
  take?: number;
  skip?: number;
}

export function listThreads(params: ThreadListParams): Promise<Thread[]> {
  const query = new URLSearchParams();
  query.set('folder', params.folder);
  if (params.status) query.set('status', params.status);
  if (params.canal) query.set('canal', params.canal);
  if (params.q) query.set('q', params.q);
  if (params.account) query.set('account', params.account);
  if (params.take !== undefined) query.set('take', String(params.take));
  if (params.skip !== undefined) query.set('skip', String(params.skip));
  return apiFetch<Thread[]>(`/threads?${query.toString()}`);
}

export function getThread(id: string): Promise<ThreadDetail> {
  return apiFetch<ThreadDetail>(`/threads/${id}`);
}

export function assignThread(id: string, assignedToId: string | null): Promise<Thread> {
  return apiFetch<Thread>(`/threads/${id}/assign`, { method: 'PATCH', body: { assignedToId } });
}

export function setThreadStatus(id: string, status: ThreadStatus): Promise<Thread> {
  return apiFetch<Thread>(`/threads/${id}/status`, { method: 'PATCH', body: { status } });
}

export function markThreadUnread(id: string): Promise<Thread> {
  return apiFetch<Thread>(`/threads/${id}/unread`, { method: 'PATCH' });
}

export function setThreadStarred(id: string, starred: boolean): Promise<Thread> {
  return apiFetch<Thread>(`/threads/${id}/star`, { method: 'PATCH', body: { starred } });
}

export function archiveThread(id: string): Promise<Thread> {
  return apiFetch<Thread>(`/threads/${id}/archive`, { method: 'PATCH' });
}

export function unarchiveThread(id: string): Promise<Thread> {
  return apiFetch<Thread>(`/threads/${id}/unarchive`, { method: 'PATCH' });
}

export function trashThread(id: string): Promise<Thread> {
  return apiFetch<Thread>(`/threads/${id}/trash`, { method: 'PATCH' });
}

export function restoreThread(id: string): Promise<Thread> {
  return apiFetch<Thread>(`/threads/${id}/restore`, { method: 'PATCH' });
}

export function deleteThread(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/threads/${id}`, { method: 'DELETE' });
}

export function getThreadActivity(id: string): Promise<ThreadActivity[]> {
  return apiFetch<ThreadActivity[]>(`/threads/${id}/activity`);
}

export interface BulkPatch {
  status?: ThreadStatus;
  archivedAt?: boolean;
  deletedAt?: boolean;
}

export function bulkUpdateThreads(ids: string[], patch: BulkPatch): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/threads/bulk', { method: 'PATCH', body: { ids, ...patch } });
}
