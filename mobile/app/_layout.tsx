import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/lib/queryClient';
import { SessionProvider } from '../src/context/SessionContext';
import { AccountSwitcherProvider } from '../src/context/AccountSwitcherContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

// Bande d'état (Android) désormais transparente par défaut (edge-to-edge, voir
// expo-status-bar SDK 57 qui a retiré son ancienne prop backgroundColor) : sans
// ça, la zone derrière la barre de statut retombe sur le noir par défaut de la
// fenêtre native au lieu d'épouser le thème actif — on peint nous-mêmes le fond
// racine pour que ça reste blanc/neutral-950 comme le reste de l'app.
function RootNavigator() {
  const { theme } = useTheme();
  const backgroundColor = theme === 'dark' ? '#0a0a0a' : '#ffffff';

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(backgroundColor);
  }, [backgroundColor]);

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    // Requis par le tiroir de navigation (swipe depuis le bord) — voir app/(app)/(drawer)/_layout.tsx
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <AccountSwitcherProvider>
              <ThemeProvider>
                <RootNavigator />
              </ThemeProvider>
            </AccountSwitcherProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
