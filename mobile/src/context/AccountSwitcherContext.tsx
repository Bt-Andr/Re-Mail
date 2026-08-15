import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listAccounts } from '../api/accounts';
import { useSession } from './SessionContext';
import type { AccountSummary } from '../types/api';

const SELECTED_ACCOUNT_KEY = 'rmm_selected_account';

interface AccountSwitcherContextValue {
  accounts: AccountSummary[];
  loading: boolean;
  selectedAccountId: string | null; // null = "Toutes les boîtes"
  setSelectedAccountId: (id: string | null) => void;
  refetch: () => void;
}

const AccountSwitcherContext = createContext<AccountSwitcherContextValue | null>(null);

export function AccountSwitcherProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_ACCOUNT_KEY).then(stored => {
      if (stored) setSelectedAccountIdState(stored);
    });
  }, []);

  const setSelectedAccountId = useCallback((id: string | null) => {
    setSelectedAccountIdState(id);
    if (id) void AsyncStorage.setItem(SELECTED_ACCOUNT_KEY, id);
    else void AsyncStorage.removeItem(SELECTED_ACCOUNT_KEY);
  }, []);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
    enabled: !!user,
  });

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['accounts'] });
  }, [queryClient]);

  // Le compte sélectionné a pu être supprimé entre-temps (déconnexion d'une boîte) —
  // repli silencieux sur "Toutes les boîtes" plutôt que de filtrer sur un id fantôme.
  useEffect(() => {
    if (selectedAccountId && !isLoading && !accounts.some(a => a.id === selectedAccountId)) {
      setSelectedAccountId(null);
    }
  }, [accounts, isLoading, selectedAccountId, setSelectedAccountId]);

  return (
    <AccountSwitcherContext.Provider value={{ accounts, loading: isLoading, selectedAccountId, setSelectedAccountId, refetch }}>
      {children}
    </AccountSwitcherContext.Provider>
  );
}

export function useAccountSwitcher(): AccountSwitcherContextValue {
  const ctx = useContext(AccountSwitcherContext);
  if (!ctx) throw new Error('useAccountSwitcher must be used within AccountSwitcherProvider');
  return ctx;
}
