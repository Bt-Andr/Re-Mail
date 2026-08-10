import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { me } from '../api/auth';
import { ApiError, registerUnauthorizedHandler } from '../api/client';
import { clearCachedUser, clearToken, getCachedUser, getToken, setCachedUser, setToken } from '../lib/session';
import { unregisterDevice } from '../api/devices';
import type { User } from '../types/api';

interface SessionContextValue {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: (pushToken?: string | null) => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async (pushToken?: string | null) => {
    if (pushToken) {
      await unregisterDevice(pushToken).catch(() => {});
    }
    await clearToken();
    await clearCachedUser();
    setUser(null);
  }, []);

  const login = useCallback(async (token: string, nextUser: User) => {
    await setToken(token);
    await setCachedUser(nextUser);
    setUser(nextUser);
  }, []);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { user: fetchedUser } = await me();
      setUser(fetchedUser);
      await setCachedUser(fetchedUser);
    } catch (e) {
      // Un 401 avec token signifie une session réellement invalidée (apiFetch a déjà
      // effacé le token) : déconnexion légitime. Toute autre erreur (réseau injoignable
      // le temps que l'app ressorte du fond, backend momentanément down, timeout) ne
      // prouve rien sur la validité de la session — garder l'utilisateur affiché à partir
      // du profil mis en cache plutôt que de le renvoyer sur l'écran de connexion alors
      // que son token est toujours valide (c'était le bug : déco après une courte fermeture).
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
      } else {
        setUser(await getCachedUser());
      }
    }
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null);
      router.replace('/login');
    });
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
