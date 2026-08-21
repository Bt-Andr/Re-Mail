import * as SecureStore from 'expo-secure-store';
import type { User, Organization } from '../types/api';

export interface StoredAccount {
  token: string;
  user: User;
  organization: Organization;
}

// Deux notions de compte stockées séparément : `personal` est un slot unique
// (remplacé, jamais empilé) ; les organisations connectées sont additives — voir plan
// "Découpler l'identité personnelle de l'accès organisation", Phase 2.
//
// Chaque organisation a sa PROPRE clé SecureStore (`rmm_org_<userId>`) plutôt qu'un
// tableau dans une seule clé : SecureStore a une limite de taille par valeur sur
// Android (backend Keystore) — un blob combinant plusieurs jetons+profils la
// dépasserait vite, alors qu'un compte seul par clé y reste toujours confortablement.
const PERSONAL_KEY = 'rmm_personal';
const ORG_IDS_KEY = 'rmm_org_ids';
const ORG_KEY_PREFIX = 'rmm_org_';
const ACTIVE_KEY = 'rmm_active_id';

async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getStoredPersonal(): Promise<StoredAccount | null> {
  return readJSON<StoredAccount>(PERSONAL_KEY);
}

export async function setStoredPersonal(account: StoredAccount | null): Promise<void> {
  if (account) await SecureStore.setItemAsync(PERSONAL_KEY, JSON.stringify(account));
  else await SecureStore.deleteItemAsync(PERSONAL_KEY);
}

async function getOrgIds(): Promise<string[]> {
  return (await readJSON<string[]>(ORG_IDS_KEY)) ?? [];
}

async function setOrgIds(ids: string[]): Promise<void> {
  if (ids.length) await SecureStore.setItemAsync(ORG_IDS_KEY, JSON.stringify(ids));
  else await SecureStore.deleteItemAsync(ORG_IDS_KEY);
}

export async function getStoredOrgs(): Promise<StoredAccount[]> {
  const ids = await getOrgIds();
  const accounts = await Promise.all(ids.map(id => readJSON<StoredAccount>(ORG_KEY_PREFIX + id)));
  return accounts.filter((a): a is StoredAccount => !!a);
}

export async function setStoredOrgs(accounts: StoredAccount[]): Promise<void> {
  const previousIds = await getOrgIds();
  const nextIds = accounts.map(a => a.user.id);
  await Promise.all(previousIds.filter(id => !nextIds.includes(id)).map(id => SecureStore.deleteItemAsync(ORG_KEY_PREFIX + id)));
  await Promise.all(accounts.map(a => SecureStore.setItemAsync(ORG_KEY_PREFIX + a.user.id, JSON.stringify(a))));
  await setOrgIds(nextIds);
}

export async function getActiveAccountId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_KEY);
}

export async function setActiveAccountId(id: string | null): Promise<void> {
  if (id) await SecureStore.setItemAsync(ACTIVE_KEY, id);
  else await SecureStore.deleteItemAsync(ACTIVE_KEY);
}

// Résout le jeton du compte actif pour apiFetch — retombe sur le premier compte
// disponible si l'id actif ne correspond plus à rien (compte déconnecté ailleurs).
export async function resolveActiveToken(): Promise<string | null> {
  const activeId = await getActiveAccountId();
  const personal = await getStoredPersonal();
  if (personal && personal.user.id === activeId) return personal.token;
  const orgs = await getStoredOrgs();
  const org = orgs.find(a => a.user.id === activeId);
  if (org) return org.token;
  return personal?.token ?? orgs[0]?.token ?? null;
}
