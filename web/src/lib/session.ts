import { clearToken, setToken } from './apiClient'
import type { User } from '../types/api'

// Point d'entrée unique pour établir/effacer une session (utilisé par
// SessionContext) — garde toute la logique de stockage local à un seul endroit.
export function persistSession(token: string): void {
  setToken(token)
}

export function clearSession(): void {
  clearToken()
}

export function displayName(user: Pick<User, 'nom' | 'username'>): string {
  return user.nom || user.username
}
