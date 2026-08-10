import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types/api';

const TOKEN_KEY = 'rmm_token';
const CACHED_USER_KEY = 'rmm_cached_user';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// Copie non sensible du profil utilisateur, utilisée uniquement pour garder une
// session affichée le temps d'un raté réseau au démarrage (voir SessionContext.refresh) —
// jamais consultée pour une décision d'autorisation, seul le token fait foi côté API.
export async function getCachedUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function setCachedUser(user: User): Promise<void> {
  await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
}

export async function clearCachedUser(): Promise<void> {
  await AsyncStorage.removeItem(CACHED_USER_KEY);
}
