import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { me } from '../api/auth';
import { ApiError, registerUnauthorizedHandler } from '../api/client';
import {
  getStoredPersonal,
  setStoredPersonal,
  getStoredOrgs,
  setStoredOrgs,
  getActiveAccountId,
  setActiveAccountId,
  resolveActiveToken,
  type StoredAccount,
} from '../lib/accountsStorage';
import { unregisterDevice } from '../api/devices';
import { queryClient } from '../lib/queryClient';
import type { User, Organization } from '../types/api';

export interface SessionAccount {
  id: string;
  kind: 'personal' | 'org';
  user: User;
  organization: Organization;
}

interface SessionContextValue {
  user: User | null;
  loading: boolean;
  accounts: SessionAccount[];
  activeAccountId: string | null;
  hasPersonalAccount: boolean;
  // Marqueur générique "un sous-flux multi-écrans attend une identité personnelle" —
  // welcome.tsx l'utilise avec 'create-enterprise'/'join-enterprise' pour reprendre sa
  // propre intention ; activate.tsx pousse une valeur distincte juste pour tenir
  // (auth)/_layout.tsx à distance pendant qu'il attend son propre retour (router.back()).
  // Tant qu'il est non-null, le groupe (auth) ne doit PAS rediriger vers l'inbox dès que
  // user devient vrai : le sous-flux n'est pas terminé.
  pendingOrgIntent: string | null;
  setPendingOrgIntent: (intent: string | null) => void;
  // Établit/remplace l'identité PERSONNELLE (Google, IMAP perso, inscription perso,
  // login username/mot de passe résolvant un compte perso) — jamais empilée.
  login: (token: string, user: User, organization: Organization) => Promise<void>;
  // Connexion ADDITIVE à une organisation — symétrique à connecter une boîte externe,
  // ne touche jamais au slot perso. Voir plan "Découpler l'identité personnelle de
  // l'accès organisation", Phase 2.
  connectOrganization: (token: string, user: User, organization: Organization) => Promise<void>;
  switchAccount: (id: string) => Promise<void>;
  // Déconnexion par compte : sans argument, déconnecte le compte actif ; les autres
  // comptes connectés restent actifs (décision produit actée).
  logout: (id?: string, pushToken?: string | null) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [personal, setPersonalState] = useState<StoredAccount | null>(null);
  const [orgs, setOrgsState] = useState<StoredAccount[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingOrgIntent, setPendingOrgIntent] = useState<string | null>(null);
  const hydrated = useRef(false);

  const setPersonal = useCallback(async (account: StoredAccount | null) => {
    setPersonalState(account);
    await setStoredPersonal(account);
  }, []);

  const setOrgs = useCallback(async (accounts: StoredAccount[]) => {
    setOrgsState(accounts);
    await setStoredOrgs(accounts);
  }, []);

  const setActiveId = useCallback(async (id: string | null) => {
    setActiveIdState(id);
    await setActiveAccountId(id);
  }, []);

  const accounts = useMemo<SessionAccount[]>(() => {
    const list: SessionAccount[] = [];
    if (personal) list.push({ id: personal.user.id, kind: 'personal', user: personal.user, organization: personal.organization });
    for (const org of orgs) list.push({ id: org.user.id, kind: 'org', user: org.user, organization: org.organization });
    return list;
  }, [personal, orgs]);

  const active = accounts.find(a => a.id === activeId) ?? accounts[0] ?? null;

  const login = useCallback(
    async (token: string, nextUser: User, nextOrg: Organization) => {
      await setPersonal({ token, user: nextUser, organization: nextOrg });
      await setActiveId(nextUser.id);
    },
    [setPersonal, setActiveId]
  );

  const connectOrganization = useCallback(
    async (token: string, nextUser: User, nextOrg: Organization) => {
      const next = [...orgs.filter(a => a.user.id !== nextUser.id), { token, user: nextUser, organization: nextOrg }];
      await setOrgs(next);
      await setActiveId(nextUser.id);
    },
    [orgs, setOrgs, setActiveId]
  );

  const logout = useCallback(
    async (id?: string, pushToken?: string | null) => {
      const targetId = id ?? activeId;
      if (!targetId) return;
      if (pushToken) await unregisterDevice(pushToken).catch(() => {});

      const remainingPersonal = personal && personal.user.id === targetId ? null : personal;
      const remainingOrgs = orgs.filter(a => a.user.id !== targetId);
      await setPersonal(remainingPersonal);
      await setOrgs(remainingOrgs);

      if (targetId === activeId) {
        await setActiveId(remainingPersonal?.user.id ?? remainingOrgs[0]?.user.id ?? null);
      }
      queryClient.clear();
    },
    [activeId, personal, orgs, setPersonal, setOrgs, setActiveId]
  );

  // Changer de compte actif change le jeton porté par chaque requête — plutôt que
  // d'auditer/invalider chaque hook de données un par un, on vide le cache react-query :
  // le backend reste scopé à une seule organisation par requête (aucun changement
  // serveur pour ce chantier), donc "changer d'organisation" doit tout re-fetcher.
  const switchAccount = useCallback(
    async (id: string) => {
      await setActiveId(id);
      queryClient.clear();
    },
    [setActiveId]
  );

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      void (async () => {
        const failedId = activeId;
        if (!failedId) return;
        await logout(failedId);
        router.replace('/(auth)/welcome');
      })();
    });
  }, [activeId, logout]);

  // Hydrate le storage au démarrage puis valide/rafraîchit UNIQUEMENT le compte actif
  // (un seul appel /auth/me, comme avant) — les autres comptes stockés restent tels
  // quels tant qu'ils ne deviennent pas actifs.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    void (async () => {
      const [storedPersonal, storedOrgs, storedActiveId] = await Promise.all([
        getStoredPersonal(),
        getStoredOrgs(),
        getActiveAccountId(),
      ]);
      setPersonalState(storedPersonal);
      setOrgsState(storedOrgs);
      const resolvedActiveId =
        storedActiveId && (storedPersonal?.user.id === storedActiveId || storedOrgs.some(a => a.user.id === storedActiveId))
          ? storedActiveId
          : (storedPersonal?.user.id ?? storedOrgs[0]?.user.id ?? null);
      setActiveIdState(resolvedActiveId);

      if (!resolvedActiveId) {
        setLoading(false);
        return;
      }

      try {
        const { user: fetchedUser } = await me();
        const token = await resolveActiveToken();
        if (!token) return;
        const fresh: StoredAccount = { token, user: fetchedUser, organization: fetchedUser.organization! };
        if (storedPersonal && storedPersonal.user.id === resolvedActiveId) {
          await setPersonal(fresh);
        } else {
          await setOrgs(storedOrgs.map(a => (a.user.id === resolvedActiveId ? fresh : a)));
        }
      } catch (e) {
        // Un 401 avec jeton signifie une session réellement invalidée (apiFetch a déjà
        // déclenché unauthorizedHandler) : rien de plus à faire ici. Toute autre erreur
        // (réseau injoignable le temps que l'app ressorte du fond, backend
        // momentanément down) ne prouve rien sur la validité de la session — garder le
        // profil stocké tel quel plutôt que de déconnecter sur un simple raté réseau.
        if (!(e instanceof ApiError && e.status === 401)) {
          // rien à faire, le profil stocké reste affiché
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [setPersonal, setOrgs]);

  const value: SessionContextValue = {
    user: active ? { ...active.user, organization: active.organization } : null,
    loading,
    accounts,
    activeAccountId: active?.id ?? null,
    hasPersonalAccount: !!personal,
    pendingOrgIntent,
    setPendingOrgIntent,
    login,
    connectOrganization,
    switchAccount,
    logout,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
