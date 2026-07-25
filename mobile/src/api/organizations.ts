import { apiFetch } from './client';
import type { OrgSummary } from '../types/api';

export function getOrgSummary(): Promise<OrgSummary> {
  return apiFetch<OrgSummary>('/organizations/me');
}
