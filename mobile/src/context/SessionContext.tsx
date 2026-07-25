import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { me } from '../api/auth';
import { registerUnauthorizedHandler } from '../api/client';
import { clearToken, getToken, setToken } from '../lib/session';
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
    setUser(null);
  }, []);

  const login = useCallback(async (token: string, nextUser: User) => {
    await setToken(token);
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
    } catch {
      setUser(null);
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
