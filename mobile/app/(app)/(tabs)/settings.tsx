import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Moon, Sun } from 'lucide-react-native';
import { useSession } from '../../../src/context/SessionContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { Button } from '../../../src/components/ui/Button';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  MEMBER: 'Membre',
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useSession();
  const { theme, toggleTheme } = useTheme();

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 gap-6 bg-neutral-50 px-4 pb-6 dark:bg-neutral-950">
      <Text className="pt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Réglages</Text>

      <View className="gap-1 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{user?.nom}</Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">{user?.email}</Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          {user?.orgRole ? ROLE_LABEL[user.orgRole] ?? user.orgRole : ''} · {user?.organization?.name}
        </Text>
      </View>

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

      <Button variant="destructive" onPress={() => logout()}>
        Se déconnecter
      </Button>
    </View>
  );
}
