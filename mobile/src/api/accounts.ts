import { apiFetch } from './client';
import type { AccountSummary } from '../types/api';

export function listAccounts(): Promise<AccountSummary[]> {
  return apiFetch<AccountSummary[]>('/accounts');
}
