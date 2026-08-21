import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { ChevronRight, Mail, Moon, Sun } from 'lucide-react-native';
import { useSession } from '../../src/context/SessionContext';
import { useAccountContext } from '../../src/hooks/useAccountContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { getBiometricLockEnabled, setBiometricLockEnabled } from '../../src/lib/biometricLock';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  MEMBER: 'Membre',
};

// Brouillons et Administration sont maintenant accessibles directement depuis le
// tiroir (voir src/components/inbox/DrawerContent.tsx) — cet écran ne garde que ce
// qui concerne le compte lui-même, pour ne pas dupliquer la même navigation à deux endroits.
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useSession();
  const { isPersonal } = useAccountContext();
  const { theme, toggleTheme } = useTheme();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  useEffect(() => {
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(), getBiometricLockEnabled()]).then(
      ([hasHardware, isEnrolled, enabled]) => {
        setBiometricAvailable(hasHardware && isEnrolled);
        setBiometricEnabled(enabled);
      }
    );
  }, []);

  const toggleBiometricLock = async (next: boolean) => {
    setBiometricBusy(true);
    try {
      if (next) {
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirmer pour activer le verrouillage' });
        if (!result.success) return;
      }
      await setBiometricLockEnabled(next);
      setBiometricEnabled(next);
    } finally {
      setBiometricBusy(false);
    }
  };

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 gap-6 bg-neutral-50 px-4 pb-6 dark:bg-neutral-950">
      <Text className="pt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Réglages</Text>

      <View className="gap-1 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{user?.nom}</Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">{user?.email}</Text>
        {!isPersonal && (
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {user?.orgRole ? ROLE_LABEL[user.orgRole] ?? user.orgRole : ''} · {user?.organization?.name}
          </Text>
        )}
      </View>

      <Pressable
        onPress={() => router.push('/(app)/mailboxes')}
        className="flex-row items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <View className="flex-row items-center gap-2.5">
          <Mail size={16} color="#6b7280" />
          <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Boîtes externes</Text>
        </View>
        <ChevronRight size={16} color="#9ca3af" />
      </Pressable>

      <View className="gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Apparence</Text>
        <Button variant="secondary" onPress={toggleTheme} className="flex-row gap-2 self-start px-3">
          <>
            {theme === 'dark' ? <Sun size={14} color="#f5f5f5" /> : <Moon size={14} color="#111827" />}
            <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            </Text>
          </>
        </Button>
      </View>

      {biometricAvailable && (
        <View className="gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Sécurité</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Verrouillage biométrique</Text>
            <Switch value={biometricEnabled} onValueChange={toggleBiometricLock} disabled={biometricBusy} />
          </View>
        </View>
      )}

      <Button variant="destructive" onPress={() => void logout()}>
        Se déconnecter
      </Button>
    </View>
  );
}
