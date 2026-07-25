import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { colorScheme, useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'rmm_theme';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme: current } = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark') colorScheme.set(stored);
      setReady(true);
    });
  }, []);

  const toggleTheme = () => {
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    colorScheme.set(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ theme: current === 'dark' ? 'dark' : 'light', toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
