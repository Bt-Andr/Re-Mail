import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../src/context/SessionContext';

export default function AuthGroupLayout() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
        <ActivityIndicator />
      </View>
    );
  }

  if (user) return <Redirect href="/(app)/(drawer)/inbox" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
