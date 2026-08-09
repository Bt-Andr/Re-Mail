import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { Archive, AtSign, FileEdit, Inbox, LogOut, Send, Settings, Trash2, UserPlus, Users as UsersIcon, Building2, FileText } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useSession } from '../../context/SessionContext';

const FOLDER_ITEMS = [
  { route: 'inbox', label: 'Réception', icon: Inbox },
  { route: 'sent', label: 'Envoyés', icon: Send },
  { route: 'archive', label: 'Archivés', icon: Archive },
  { route: 'trash', label: 'Corbeille', icon: Trash2 },
] as const;

const ADMIN_ITEMS = [
  { href: '/(app)/admin/mail-routes', label: 'Adresses mail', icon: AtSign },
  { href: '/(app)/admin/invites', label: 'Invitations', icon: UserPlus },
  { href: '/(app)/admin/users', label: 'Utilisateurs', icon: UsersIcon },
  { href: '/(app)/admin/org-settings', label: 'Organisation', icon: Building2 },
  { href: '/(app)/admin/reply-templates', label: 'Modèles de réponse', icon: FileText },
] as const;

function isManager(role?: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

// Tiroir façon Gmail : dossiers de mail en premier, Brouillons + Réglages/Administration
// ensuite — remplace entièrement les anciens onglets du bas (Inbox/Réglages).
export function InboxDrawerContent({ state, navigation }: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useSession();
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#f5f5f5' : '#111827';
  const activeRoute = state.routeNames[state.index];

  const close = () => navigation.closeDrawer();

  return (
    <View style={{ paddingTop: insets.top + 8 }} className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-row items-center gap-3 px-5 py-5">
        <Image source={require('../../../assets/icon.png')} className="h-9 w-9 rounded-lg" />
        <Text className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Re-mail</Text>
      </View>

      <View className="gap-1 px-3">
        {FOLDER_ITEMS.map(item => {
          const active = activeRoute === item.route;
          return (
            <Pressable
              key={item.route}
              onPress={() => {
                navigation.navigate(item.route);
                close();
              }}
              className={`flex-row items-center gap-4 rounded-full px-4 py-3.5 ${active ? 'bg-neutral-900 dark:bg-neutral-100' : ''}`}
            >
              <item.icon size={23} color={active ? (colorScheme === 'dark' ? '#111827' : '#fff') : iconColor} />
              <Text
                className={`text-base ${active ? 'font-semibold text-white dark:text-neutral-900' : 'font-medium text-neutral-800 dark:text-neutral-200'}`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            close();
            router.push('/(app)/drafts');
          }}
          className="flex-row items-center gap-4 rounded-full px-4 py-3.5"
        >
          <FileEdit size={23} color={iconColor} />
          <Text className="text-base font-medium text-neutral-800 dark:text-neutral-200">Brouillons</Text>
        </Pressable>
      </View>

      {isManager(user?.orgRole) && (
        <View className="mt-5 gap-1 border-t border-neutral-100 px-3 pt-5 dark:border-neutral-800">
          <Text className="px-4 pb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Administration
          </Text>
          {ADMIN_ITEMS.map(item => (
            <Pressable
              key={item.href}
              onPress={() => {
                close();
                router.push(item.href);
              }}
              className="flex-row items-center gap-4 rounded-full px-4 py-3.5"
            >
              <item.icon size={23} color={iconColor} />
              <Text className="text-base font-medium text-neutral-800 dark:text-neutral-200">{item.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View className="mt-auto gap-1 border-t border-neutral-100 px-3 py-4 dark:border-neutral-800">
        <Pressable
          onPress={() => {
            close();
            router.push('/(app)/settings');
          }}
          className="flex-row items-center gap-4 rounded-full px-4 py-3.5"
        >
          <Settings size={23} color={iconColor} />
          <Text className="text-base font-medium text-neutral-800 dark:text-neutral-200">Réglages</Text>
        </Pressable>
        <Pressable onPress={() => logout()} className="flex-row items-center gap-4 rounded-full px-4 py-3.5">
          <LogOut size={23} color="#ef4444" />
          <Text className="text-base font-medium text-red-600">Déconnexion</Text>
        </Pressable>
      </View>
    </View>
  );
}
