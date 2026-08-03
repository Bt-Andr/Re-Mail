import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AtSign, ChevronRight, FileEdit, FileText, Moon, Sun, UserPlus, Users as UsersIcon, Building2 } from 'lucide-react-native';
import { useSession } from '../../../src/context/SessionContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { Button } from '../../../src/components/ui/Button';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  MEMBER: 'Membre',
};

const PERSONAL_LINKS = [{ href: '/(app)/drafts', label: 'Brouillons', icon: FileEdit }] as const;

const ADMIN_LINKS = [
  { href: '/(app)/admin/mail-routes', label: 'Adresses mail', icon: AtSign },
  { href: '/(app)/admin/invites', label: 'Invitations', icon: UserPlus },
  { href: '/(app)/admin/users', label: 'Utilisateurs', icon: UsersIcon },
  { href: '/(app)/admin/org-settings', label: 'Organisation', icon: Building2 },
  { href: '/(app)/admin/reply-templates', label: 'Modèles de réponse', icon: FileText },
] as const;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useSession();
  const { theme, toggleTheme } = useTheme();
  const isManager = user?.orgRole === 'OWNER' || user?.orgRole === 'ADMIN';

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

      <View className="gap-1 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {PERSONAL_LINKS.map((link, i) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href)}
            className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-neutral-100 dark:border-neutral-800' : ''}`}
          >
            <link.icon size={16} color="#9ca3af" />
            <Text className="flex-1 text-sm text-neutral-900 dark:text-neutral-100">{link.label}</Text>
            <ChevronRight size={16} color="#9ca3af" />
          </Pressable>
        ))}
      </View>

      {isManager && (
        <View className="gap-1 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <Text className="px-4 pt-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">Administration</Text>
          {ADMIN_LINKS.map((link, i) => (
            <Pressable
              key={link.href}
              onPress={() => router.push(link.href)}
              className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-neutral-100 dark:border-neutral-800' : ''}`}
            >
              <link.icon size={16} color="#9ca3af" />
              <Text className="flex-1 text-sm text-neutral-900 dark:text-neutral-100">{link.label}</Text>
              <ChevronRight size={16} color="#9ca3af" />
            </Pressable>
          ))}
        </View>
      )}

      <Button variant="destructive" onPress={() => logout()}>
        Se déconnecter
      </Button>
    </View>
  );
}
