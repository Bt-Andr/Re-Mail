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

export function updateOwnProEmail(userId: string, proEmail: string): Promise<OrgUser> {
  return apiFetch<OrgUser>(`/users/${userId}`, { method: 'PUT', body: { proEmail } });
}

export function transferOwnership(userId: string): Promise<{ previousOwnerId: string; owner: OrgUser }> {
  return apiFetch<{ previousOwnerId: string; owner: OrgUser }>(`/users/${userId}/transfer-ownership`, { method: 'POST' });
}
