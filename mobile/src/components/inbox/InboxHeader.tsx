import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { DrawerHeaderProps } from 'expo-router/drawer';
import { Menu, Search, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useSession } from '../../context/SessionContext';
import { useInboxSearch } from '../../context/InboxSearchContext';
import { avatarColor, initials } from '../../lib/format';

// En-tête façon Gmail : hamburger (ouvre le tiroir) — recherche — avatar (raccourci
// Réglages). Remplace l'ancienne rangée de dossiers en chips en haut de l'écran.
export function InboxHeader({ navigation }: DrawerHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useSession();
  const { search, setSearch } = useInboxSearch();

  return (
    <View
      style={{ paddingTop: insets.top + 12 }}
      className="flex-row items-center gap-2.5 border-b border-neutral-200 bg-white px-3.5 pb-4 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <Pressable onPress={() => navigation.toggleDrawer()} hitSlop={8} className="p-2">
        <Menu size={24} color={isDark ? '#f5f5f5' : '#111827'} />
      </Pressable>

      <View className="relative flex-1">
        <View className="pointer-events-none absolute left-3.5 top-0 h-full justify-center">
          <Search size={16} color={isDark ? '#8b93a1' : '#6b7280'} />
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher…"
          placeholderTextColor="#9ca3af"
          className="rounded-full border border-neutral-200 bg-neutral-100 py-2.5 pl-10 pr-9 text-base text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} className="absolute right-3.5 top-0 h-full justify-center">
            <X size={15} color={isDark ? '#8b93a1' : '#6b7280'} />
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={() => router.push('/(app)/settings')}
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: avatarColor(user?.email ?? user?.username ?? '') }}
      >
        <Text className="text-sm font-semibold text-white">{initials(user?.nom ?? user?.username ?? '?')}</Text>
      </Pressable>
    </View>
  );
}
