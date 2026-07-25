import { apiFetch } from './client';
import type { Thread, ThreadActivity, ThreadDetail, ThreadFolder, ThreadStatus } from '../types/api';

export interface ThreadListParams {
  folder: ThreadFolder;
  status?: ThreadStatus;
  canal?: string;
}

export function listThreads(params: ThreadListParams): Promise<Thread[]> {
  const query = new URLSearchParams();
  query.set('folder', params.folder);
  if (params.status) query.set('status', params.status);
  if (params.canal) query.set('canal', params.canal);
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
