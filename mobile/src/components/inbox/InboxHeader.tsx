import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { DrawerHeaderProps } from 'expo-router/drawer';
import { Menu, Search, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { colors, icons } from '@re-mail/design-tokens';
import { useSession } from '../../context/SessionContext';
import { useInboxSearch } from '../../context/InboxSearchContext';
import { useAccountSwitcher } from '../../context/AccountSwitcherContext';
import { avatarColor, initials } from '../../lib/format';
import { AccountSwitcherSheet } from './AccountSwitcherSheet';

// En-tête façon Gmail : hamburger (ouvre le tiroir) — recherche — avatar. L'avatar
// ouvre le switcher de compte s'il y a 2+ comptes connectés (voir AccountSwitcherSheet),
// sinon garde son ancien rôle de raccourci vers Réglages (aussi toujours accessible
// depuis le bas du tiroir, voir DrawerContent).
export function InboxHeader({ navigation }: DrawerHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useSession();
  const { search, setSearch } = useInboxSearch();
  const { accounts } = useAccountSwitcher();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <View
      style={{ paddingTop: insets.top + 12 }}
      className="flex-row items-center gap-2.5 border-b border-neutral-200 bg-white px-3.5 pb-4 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <Pressable onPress={() => navigation.toggleDrawer()} hitSlop={8} className="p-2">
        <Menu size={icons.nav} color={isDark ? colors.dark.foreground : colors.light.foreground} />
      </Pressable>

      <View className="relative flex-1">
        <View className="pointer-events-none absolute left-3.5 top-0 h-full justify-center">
          <Search size={icons.inlineStatus.sm} color={isDark ? colors.dark.mutedForeground : colors.light.mutedForeground} />
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
            <X size={icons.inlineStatus.sm} color={isDark ? colors.dark.mutedForeground : colors.light.mutedForeground} />
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={() => (accounts.length > 1 ? setSwitcherOpen(true) : router.push('/(app)/settings'))}
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: avatarColor(user?.email ?? user?.username ?? '') }}
      >
        <Text className="text-sm font-semibold text-white">{initials(user?.nom ?? user?.username ?? '?')}</Text>
      </Pressable>

      <AccountSwitcherSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </View>
  );
}
