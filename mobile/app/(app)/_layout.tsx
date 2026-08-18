import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../src/context/SessionContext';
import { useTheme } from '../../src/context/ThemeContext';
import { usePushRegistration } from '../../src/hooks/usePushRegistration';
import { BiometricGate } from '../../src/components/BiometricGate';

export default function AppGroupLayout() {
  const { user, loading } = useSession();
  const { theme } = useTheme();
  usePushRegistration(!!user);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/welcome" />;

  return (
    <BiometricGate>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme === 'dark' ? '#0a0a0a' : '#ffffff' } }}>
        <Stack.Screen name="(drawer)" />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Réglages' }} />
        <Stack.Screen name="mailboxes" options={{ headerShown: true, title: 'Boîtes externes' }} />
        <Stack.Screen name="thread/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="compose" options={{ presentation: 'modal', headerShown: true, title: '' }} />
        <Stack.Screen name="admin/mail-routes" options={{ headerShown: true, title: 'Adresses mail' }} />
        <Stack.Screen name="admin/invites" options={{ headerShown: true, title: 'Invitations' }} />
        <Stack.Screen name="admin/users" options={{ headerShown: true, title: 'Utilisateurs' }} />
        <Stack.Screen name="admin/org-settings" options={{ headerShown: true, title: "Organisation" }} />
        <Stack.Screen name="admin/reply-templates" options={{ headerShown: true, title: 'Modèles de réponse' }} />
        <Stack.Screen name="drafts" options={{ headerShown: true, title: 'Brouillons' }} />
      </Stack>
    </BiometricGate>
  );
}
