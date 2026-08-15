import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from 'react'
import { apiFetch } from '../lib/apiClient'
import { useSession } from './SessionContext'
import type { AccountSummary } from '../types/api'

const SELECTED_ACCOUNT_KEY = 'rmm_selected_account'

interface AccountSwitcherContextValue {
  accounts: AccountSummary[]
  loading: boolean
  selectedAccountId: string | null // null = "Toutes les boîtes"
  setSelectedAccountId: (id: string | null) => void
  refetch: () => void
}

const AccountSwitcherContext = createContext<AccountSwitcherContextValue | null>(null)

export function AccountSwitcherProvider({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(() => localStorage.getItem(SELECTED_ACCOUNT_KEY))

  const setSelectedAccountId = useCallback((id: string | null) => {
    setSelectedAccountIdState(id)
    if (id) localStorage.setItem(SELECTED_ACCOUNT_KEY, id)
    else localStorage.removeItem(SELECTED_ACCOUNT_KEY)
  }, [])

  const refetch = useCallback(() => {
    if (!user) {
      setAccounts([])
      setLoading(false)
      return
    }
    setLoading(true)
    apiFetch('/accounts')
      .then(async res => (res.ok ? setAccounts(await res.json()) : setAccounts([])))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Le compte sélectionné a pu être supprimé entre-temps (déconnexion d'une boîte) —
  // repli silencieux sur "Toutes les boîtes" plutôt que de filtrer sur un id fantôme.
  useEffect(() => {
    if (selectedAccountId && !loading && !accounts.some(a => a.id === selectedAccountId)) {
      setSelectedAccountId(null)
    }
  }, [accounts, loading, selectedAccountId, setSelectedAccountId])

  return (
    <AccountSwitcherContext.Provider value={{ accounts, loading, selectedAccountId, setSelectedAccountId, refetch }}>
      {children}
    </AccountSwitcherContext.Provider>
  )
}

export function useAccountSwitcher(): AccountSwitcherContextValue {
  const ctx = useContext(AccountSwitcherContext)
  if (!ctx) throw new Error('useAccountSwitcher must be used within AccountSwitcherProvider')
  return ctx
}
