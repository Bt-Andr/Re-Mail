import { apiFetch } from './client';
import type { AssignedTo } from '../types/api';

export function listUsers(): Promise<AssignedTo[]> {
  return apiFetch<AssignedTo[]>('/users');
}
