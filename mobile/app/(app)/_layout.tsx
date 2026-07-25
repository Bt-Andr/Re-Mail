import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../src/context/SessionContext';
import { usePushRegistration } from '../../src/hooks/usePushRegistration';

export default function AppGroupLayout() {
  const { user, loading } = useSession();
  usePushRegistration(!!user);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="thread/[id]" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="compose" options={{ presentation: 'modal', headerShown: true, title: '' }} />
    </Stack>
  );
}
