import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, registerUnauthorizedHandler } from '../lib/apiClient'
import {
  getStoredPersonal,
  setStoredPersonal,
  getStoredOrgs,
  setStoredOrgs,
  resolveActiveAccountId,
  resolveActiveToken,
  setActiveAccountId,
  type StoredAccount,
} from '../lib/accountsStorage'
import type { User, OrganizationSummary } from '../types/api'

export interface SessionAccount {
  id: string
  kind: 'personal' | 'org'
  user: User
  organization: OrganizationSummary
}

interface SessionContextValue {
  user: User | null
  organization: OrganizationSummary | null
  loading: boolean
  accounts: SessionAccount[]
  activeAccountId: string | null
  hasPersonalAccount: boolean
  // Intention "créer/rejoindre une entreprise" mise en attente le temps de connecter
  // une identité personnelle (voir WelcomePage) — tant qu'elle est posée, GuestGuard ne
  // doit PAS rediriger vers /inbox dès que hasPersonalAccount devient vrai : le sous-flux
  // n'est pas terminé, il reste à créer/rejoindre l'organisation elle-même.
  pendingOrgIntent: 'create-enterprise' | 'join-enterprise' | null
  setPendingOrgIntent: (intent: 'create-enterprise' | 'join-enterprise' | null) => void
  // Établit/remplace l'identité PERSONNELLE (Google, IMAP perso, inscription perso,
  // login username/mot de passe résolvant un compte perso) — jamais empilée, un seul
  // slot perso à la fois.
  login: (token: string, user: User, organization: OrganizationSummary) => void
  // Connexion ADDITIVE à une organisation — symétrique à connecter une boîte externe,
  // ne touche jamais au slot perso. Voir plan "Découpler l'identité personnelle de
  // l'accès organisation", Phase 2.
  connectOrganization: (token: string, user: User, organization: OrganizationSummary) => void
  switchAccount: (id: string) => void
  // Déconnexion par compte : sans argument, déconnecte le compte actif ; les autres
  // comptes connectés restent actifs (décision produit actée).
  logout: (id?: string) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [personal, setPersonalState] = useState<StoredAccount | null>(() => getStoredPersonal())
  const [orgs, setOrgsState] = useState<StoredAccount[]>(() => getStoredOrgs())
  const [activeId, setActiveIdState] = useState<string | null>(() => resolveActiveAccountId())
  const [loading, setLoading] = useState(true)
  const [pendingOrgIntent, setPendingOrgIntent] = useState<'create-enterprise' | 'join-enterprise' | null>(
    () => sessionStorage.getItem('rmm_pending_intent') as 'create-enterprise' | 'join-enterprise' | null
  )
  const navigate = useNavigate()

  const setPersonal = useCallback((account: StoredAccount | null) => {
    setPersonalState(account)
    setStoredPersonal(account)
  }, [])

  const setOrgs = useCallback((accounts: StoredAccount[]) => {
    setOrgsState(accounts)
    setStoredOrgs(accounts)
  }, [])

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id)
    setActiveAccountId(id)
  }, [])

  const updatePendingOrgIntent = useCallback((intent: 'create-enterprise' | 'join-enterprise' | null) => {
    setPendingOrgIntent(intent)
    if (intent) sessionStorage.setItem('rmm_pending_intent', intent)
    else sessionStorage.removeItem('rmm_pending_intent')
  }, [])

  const accounts = useMemo<SessionAccount[]>(() => {
    const list: SessionAccount[] = []
    if (personal) list.push({ id: personal.user.id, kind: 'personal', user: personal.user, organization: personal.organization })
    for (const org of orgs) list.push({ id: org.user.id, kind: 'org', user: org.user, organization: org.organization })
    return list
  }, [personal, orgs])

  const active = accounts.find(a => a.id === activeId) ?? accounts[0] ?? null

  const login = useCallback(
    (token: string, nextUser: User, nextOrg: OrganizationSummary) => {
      setPersonal({ token, user: nextUser, organization: nextOrg })
      setActiveId(nextUser.id)
    },
    [setPersonal, setActiveId]
  )

  const connectOrganization = useCallback(
    (token: string, nextUser: User, nextOrg: OrganizationSummary) => {
      const next = [...orgs.filter(a => a.user.id !== nextUser.id), { token, user: nextUser, organization: nextOrg }]
      setOrgs(next)
      setActiveId(nextUser.id)
    },
    [orgs, setOrgs, setActiveId]
  )

  const logout = useCallback(
    (id?: string) => {
      const targetId = id ?? activeId
      if (!targetId) return

      const remainingPersonal = personal && personal.user.id === targetId ? null : personal
      const remainingOrgs = orgs.filter(a => a.user.id !== targetId)
      setPersonal(remainingPersonal)
      setOrgs(remainingOrgs)

      if (targetId === activeId) {
        setActiveId(remainingPersonal?.user.id ?? remainingOrgs[0]?.user.id ?? null)
      }
    },
    [activeId, personal, orgs, setPersonal, setOrgs, setActiveId]
  )

  // Changer de compte actif change le jeton porté par chaque requête — plutôt que
  // d'auditer/invalider chaque hook de données un par un, on recharge : le backend
  // reste scopé à une seule organisation par requête (aucun changement serveur pour ce
  // chantier), donc "changer d'organisation" est un rechargement complet, pas un filtre.
  const switchAccount = useCallback((id: string) => {
    setActiveId(id)
    window.location.reload()
  }, [setActiveId])

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      const failedId = activeId
      if (!failedId) return
      logout(failedId)
      const remaining =
        (personal && personal.user.id !== failedId ? 1 : 0) + orgs.filter(a => a.user.id !== failedId).length
      if (remaining === 0) navigate('/welcome')
      else window.location.reload()
    })
  }, [activeId, personal, orgs, logout, navigate])

  // Ne valide/rafraîchit QUE le compte actif au démarrage (comme avant, un seul appel
  // /auth/me) — les autres comptes stockés restent tels quels tant qu'ils ne deviennent
  // pas actifs (voir switchAccount, qui recharge entièrement la page de toute façon).
  useEffect(() => {
    const currentActiveId = resolveActiveAccountId()
    if (!currentActiveId) {
      setLoading(false)
      return
    }
    apiFetch('/auth/me')
      .then(async res => {
        if (!res.ok) return
        const data = await res.json()
        const token = resolveActiveToken()
        if (!token) return
        const fresh: StoredAccount = { token, user: data.user, organization: data.user.organization }
        const storedPersonal = getStoredPersonal()
        if (storedPersonal && storedPersonal.user.id === currentActiveId) {
          setPersonal(fresh)
        } else {
          setOrgs(getStoredOrgs().map(a => (a.user.id === currentActiveId ? fresh : a)))
        }
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SessionContext.Provider
      value={{
        user: active?.user ?? null,
        organization: active?.organization ?? null,
        loading,
        accounts,
        activeAccountId: active?.id ?? null,
        hasPersonalAccount: !!personal,
        pendingOrgIntent,
        setPendingOrgIntent: updatePendingOrgIntent,
        login,
        connectOrganization,
        switchAccount,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
