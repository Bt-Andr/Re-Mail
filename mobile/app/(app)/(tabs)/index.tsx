import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, Search, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useThreads } from '../../../src/hooks/useThreads';
import { FolderTabs } from '../../../src/components/inbox/FolderTabs';
import { ThreadListItem } from '../../../src/components/inbox/ThreadListItem';
import { stripHtml } from '../../../src/lib/format';
import type { ThreadFolder, ThreadStatus } from '../../../src/types/api';

const STATUS_FILTERS: { id: ThreadStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'nouveau', label: 'Nouveau' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'resolu', label: 'Résolu' },
];

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [folder, setFolder] = useState<ThreadFolder>('inbox');
  const [status, setStatus] = useState<ThreadStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const { data: threads = [], isLoading, isRefetching, refetch } = useThreads({
    folder,
    status: status === 'all' ? undefined : status,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(
      t =>
        t.sujet.toLowerCase().includes(q) ||
        t.externalFrom.toLowerCase().includes(q) ||
        t.externalEmail.toLowerCase().includes(q) ||
        stripHtml(t.lastMessage?.body ?? '').toLowerCase().includes(q)
    );
  }, [threads, search]);

  const unreadCount = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <View className="gap-3 border-b border-neutral-200 px-4 pb-3 pt-2 dark:border-neutral-800">
        <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Messagerie</Text>
        <FolderTabs folder={folder} unreadCount={unreadCount} onChange={setFolder} />
        <View className="relative">
          <View className="pointer-events-none absolute left-2.5 top-0 h-full justify-center">
            <Search size={14} color={isDark ? '#6b7280' : '#9ca3af'} />
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher…"
            placeholderTextColor="#9ca3af"
            className="rounded-md border border-neutral-200 bg-white py-2 pl-8 pr-8 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} className="absolute right-2.5 top-0 h-full justify-center">
              <X size={13} color={isDark ? '#6b7280' : '#9ca3af'} />
            </Pressable>
          )}
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          {STATUS_FILTERS.map(f => {
            const active = status === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setStatus(f.id)}
                className={`rounded-full border px-2.5 py-1 ${
                  active
                    ? 'border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100'
                    : 'border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <Text
                  className={`text-xs ${active ? 'font-medium text-white dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400'}`}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={t => t.id}
          contentContainerClassName="gap-2 p-4"
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <ThreadListItem thread={item} onPress={() => router.push(`/(app)/thread/${item.id}`)} />
          )}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-sm text-neutral-400 dark:text-neutral-500">
                {folder === 'sent' ? 'Aucun mail envoyé' : folder === 'trash' ? 'Corbeille vide' : 'Aucun résultat'}
              </Text>
            </View>
          }
        />
      )}

      <Pressable
        onPress={() => router.push('/(app)/compose?mode=new')}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-neutral-900 shadow-lg dark:bg-neutral-100"
      >
        <Plus size={24} color={isDark ? '#111827' : '#fff'} />
      </Pressable>
    </View>
  );
}
