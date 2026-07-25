import { apiFetch } from './client';
import type { AssignedTo, OrgUser } from '../types/api';

export function listUsers(): Promise<AssignedTo[]> {
  return apiFetch<AssignedTo[]>('/users');
}

export function listOrgUsers(): Promise<OrgUser[]> {
  return apiFetch<OrgUser[]>('/users');
}

export function updateSenderGrants(userId: string, grantedSenders: string[]): Promise<OrgUser> {
  return apiFetch<OrgUser>(`/users/${userId}`, { method: 'PUT', body: { grantedSenders } });
}
