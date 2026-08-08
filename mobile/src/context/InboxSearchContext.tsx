import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface InboxSearchContextValue {
  search: string;
  setSearch: (value: string) => void;
  debouncedSearch: string;
}

const InboxSearchContext = createContext<InboxSearchContextValue | null>(null);

const DEBOUNCE_MS = 350;

// Recherche partagée entre l'en-tête (barre de recherche, persistante comme chez
// Gmail) et les écrans de dossier (Réception/Envoyés/Corbeille), qui vivent
// maintenant dans des routes séparées sous le tiroir — un contexte évite de
// faire transiter la valeur par les options de navigation.
export function InboxSearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <InboxSearchContext.Provider value={{ search, setSearch, debouncedSearch }}>
      {children}
    </InboxSearchContext.Provider>
  );
}

export function useInboxSearch(): InboxSearchContextValue {
  const ctx = useContext(InboxSearchContext);
  if (!ctx) throw new Error('useInboxSearch must be used within InboxSearchProvider');
  return ctx;
}
