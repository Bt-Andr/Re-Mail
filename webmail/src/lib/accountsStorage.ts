import type { User, OrganizationSummary } from '../types/api'

export interface StoredAccount {
  token: string
  user: User
  organization: OrganizationSummary
}

// Deux notions de compte stockées séparément : `personal` est un slot unique
// (remplacé, jamais empilé — votre identité stable) ; `orgs` est une liste
// (connexions additives à des organisations, symétrique à connecter un Gmail) — voir
// plan "Découpler l'identité personnelle de l'accès organisation", Phase 2.
const PERSONAL_KEY = 'rmm_personal'
const ORGS_KEY = 'rmm_orgs'
const ACTIVE_KEY = 'rmm_active_id'

function readJSON<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function getStoredPersonal(): StoredAccount | null {
  return readJSON<StoredAccount>(PERSONAL_KEY)
}

export function setStoredPersonal(account: StoredAccount | null): void {
  if (account) localStorage.setItem(PERSONAL_KEY, JSON.stringify(account))
  else localStorage.removeItem(PERSONAL_KEY)
}

export function getStoredOrgs(): StoredAccount[] {
  return readJSON<StoredAccount[]>(ORGS_KEY) ?? []
}

export function setStoredOrgs(accounts: StoredAccount[]): void {
  if (accounts.length) localStorage.setItem(ORGS_KEY, JSON.stringify(accounts))
  else localStorage.removeItem(ORGS_KEY)
}

export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveAccountId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
}

// Résout le jeton du compte actif pour apiFetch — l'identité perso et chaque
// organisation connectée ont chacune leur propre JWT (le backend garde un jeton scopé à
// une seule organisation par requête, aucun changement côté serveur pour ce chantier).
// Retombe sur le premier compte disponible si l'id actif ne correspond plus à rien
// (compte déconnecté ailleurs) plutôt que de renvoyer null alors qu'un compte existe.
export function resolveActiveToken(): string | null {
  const activeId = getActiveAccountId()
  const personal = getStoredPersonal()
  if (personal && personal.user.id === activeId) return personal.token
  const orgs = getStoredOrgs()
  const org = orgs.find(a => a.user.id === activeId)
  if (org) return org.token
  return personal?.token ?? orgs[0]?.token ?? null
}

export function resolveActiveAccountId(): string | null {
  const activeId = getActiveAccountId()
  const personal = getStoredPersonal()
  if (personal && personal.user.id === activeId) return activeId
  const orgs = getStoredOrgs()
  if (orgs.some(a => a.user.id === activeId)) return activeId
  return personal?.user.id ?? orgs[0]?.user.id ?? null
}

export function displayName(user: Pick<User, 'nom' | 'username'>): string {
  return user.nom || user.username
}
