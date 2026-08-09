import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ListFilter, Plus } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useThreads } from '../../hooks/useThreads';
import { useInboxSearch } from '../../context/InboxSearchContext';
import { bulkUpdateThreads, type BulkPatch } from '../../api/threads';
import { describeError } from '../../api/client';
import { ThreadListItem } from './ThreadListItem';
import { SelectionBar } from './SelectionBar';
import { ErrorState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import type { ThreadFolder, ThreadStatus } from '../../types/api';

const STATUS_FILTERS: { id: ThreadStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'nouveau', label: 'Nouveau' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'resolu', label: 'Résolu' },
];

// Corps d'écran partagé par les 3 routes de dossier (inbox/sent/trash sous le
// tiroir) — recherche/hamburger/avatar vivent désormais dans InboxHeader (en-tête
// du Drawer), plus dans ce composant.
export function FolderScreen({ folder }: { folder: ThreadFolder }) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [status, setStatus] = useState<ThreadStatus | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { debouncedSearch } = useInboxSearch();
  const activeFilter = STATUS_FILTERS.find(f => f.id === status) ?? STATUS_FILTERS[0];
  const queryClient = useQueryClient();

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  const bulkAction = async (patch: BulkPatch) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      await bulkUpdateThreads(ids, patch);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    } catch (e) {
      Alert.alert('Erreur', describeError(e));
    }
  };

  const {
    threads,
    isLoading,
    isError,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useThreads({
    folder,
    status: status === 'all' ? undefined : status,
    q: debouncedSearch || undefined,
  });

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      {selectedIds.size > 0 ? (
        <SelectionBar folder={folder} count={selectedIds.size} onClear={clearSelection} onAction={bulkAction} />
      ) : (
        <View className="border-b border-neutral-200 px-4 pb-3 pt-3 dark:border-neutral-800">
          <Pressable
            onPress={() => setFiltersOpen(true)}
            className={`flex-row items-center self-start gap-2 rounded-full border px-3.5 py-2 ${
              status === 'all' ? 'border-neutral-200 dark:border-neutral-700' : 'border-neutral-900 dark:border-neutral-100'
            }`}
          >
            <ListFilter size={16} color={isDark ? '#f5f5f5' : '#111827'} />
            <Text className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {status === 'all' ? 'Filtres' : activeFilter.label}
            </Text>
            {status !== 'all' && <View className="h-1.5 w-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100" />}
          </Pressable>
        </View>
      )}

      <Modal open={filtersOpen} title="Filtrer par statut" onClose={() => setFiltersOpen(false)}>
        <View className="gap-1">
          {STATUS_FILTERS.map(f => {
            const active = status === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  setStatus(f.id);
                  setFiltersOpen(false);
                }}
                className={`flex-row items-center justify-between rounded-lg px-4 py-3.5 ${active ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}
              >
                <Text
                  className={`text-base ${active ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'font-medium text-neutral-700 dark:text-neutral-300'}`}
                >
                  {f.label}
                </Text>
                {active && <Check size={19} color={isDark ? '#f5f5f5' : '#111827'} />}
              </Pressable>
            );
          })}
        </View>
      </Modal>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={t => t.id}
          contentContainerClassName="gap-2 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={refetch}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          renderItem={({ item }) => (
            <ThreadListItem
              thread={item}
              folder={folder}
              selected={selectedIds.has(item.id)}
              selectionMode={selectedIds.size > 0}
              onPress={() => (selectedIds.size > 0 ? toggleSelect(item.id) : router.push(`/(app)/thread/${item.id}`))}
              onLongPress={() => toggleSelect(item.id)}
            />
          )}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator className="py-4" /> : null}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-sm text-neutral-400 dark:text-neutral-500">
                {debouncedSearch
                  ? 'Aucun résultat pour cette recherche'
                  : folder === 'sent'
                    ? 'Aucun mail envoyé'
                    : folder === 'trash'
                      ? 'Corbeille vide'
                      : folder === 'archive'
                        ? 'Aucun mail archivé'
                        : 'Aucun résultat'}
              </Text>
            </View>
          }
        />
      )}

      <Pressable
        onPress={() => router.push('/(app)/compose?mode=new')}
        style={{ bottom: insets.bottom + 24 }}
        className="absolute right-6 h-14 w-14 items-center justify-center rounded-full bg-neutral-900 shadow-lg dark:bg-neutral-100"
      >
        <Plus size={24} color={isDark ? '#111827' : '#fff'} />
      </Pressable>
    </View>
  );
}
