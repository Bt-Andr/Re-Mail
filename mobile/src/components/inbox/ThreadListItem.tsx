import { useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useColorScheme } from 'nativewind';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Check, Star, Trash2, Undo2 } from 'lucide-react-native';
import { avatarColor, formatRelativeTime, initials, stripHtml } from '../../lib/format';
import { archiveThread, restoreThread, setThreadStarred, trashThread, unarchiveThread } from '../../api/threads';
import type { Thread, ThreadFolder } from '../../types/api';

// Même définition que AnimatedInterpolation dans react-native-gesture-handler/Swipeable.d.ts
// (non exporté publiquement) — évite un `any` sur le paramètre reçu par renderLeftActions/renderRightActions.
type SwipeProgress = ReturnType<Animated.Value['interpolate']>;

const STATUS_LABEL: Record<Thread['status'], string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  resolu: 'Résolu',
};

const STATUS_CLASS: Record<Thread['status'], string> = {
  nouveau: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  en_cours: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  resolu: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
};

// Actions révélées au swipe, par dossier — même convention que web (bouton dans le
// détail) : gauche du swipe = corbeille (destructif), droite du swipe = classement
// (archiver/désarchiver/restaurer). Le dossier corbeille n'a qu'une action (restaurer).
function swipeActionsFor(folder: ThreadFolder) {
  if (folder === 'trash') return { left: 'restore', right: null } as const;
  if (folder === 'archive') return { left: 'unarchive', right: 'trash' } as const;
  return { left: 'archive', right: 'trash' } as const;
}

export function ThreadListItem({
  thread,
  folder,
  onPress,
  onLongPress,
  selected,
  selectionMode,
}: {
  thread: Thread;
  folder: ThreadFolder;
  onPress: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  selectionMode?: boolean;
}) {
  const unread = thread.unreadCount > 0;
  const senderSeed = thread.externalEmail || thread.externalFrom;
  const queryClient = useQueryClient();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const swipeableRef = useRef<Swipeable>(null);
  const actions = swipeActionsFor(folder);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['threads'] });

  const starMutation = useMutation({
    mutationFn: (starred: boolean) => setThreadStarred(thread.id, starred),
    // Optimiste sur le cache de la page courante : marqueur personnel à faible
    // enjeu (même logique que côté web), pas besoin d'attendre la réponse.
    onMutate: async (starred: boolean) => {
      queryClient.setQueriesData<{ pages: Thread[][] }>({ queryKey: ['threads'] }, old =>
        old ? { ...old, pages: old.pages.map(page => page.map(t => (t.id === thread.id ? { ...t, starred } : t))) } : old
      );
    },
    onError: invalidate,
    onSuccess: invalidate,
  });

  const trashMutation = useMutation({ mutationFn: () => trashThread(thread.id), onSuccess: invalidate });
  const restoreMutation = useMutation({ mutationFn: () => restoreThread(thread.id), onSuccess: invalidate });
  const archiveMutation = useMutation({ mutationFn: () => archiveThread(thread.id), onSuccess: invalidate });
  const unarchiveMutation = useMutation({ mutationFn: () => unarchiveThread(thread.id), onSuccess: invalidate });

  const runAction = (action: 'trash' | 'restore' | 'archive' | 'unarchive') => {
    swipeableRef.current?.close();
    if (action === 'trash') trashMutation.mutate();
    else if (action === 'restore') restoreMutation.mutate();
    else if (action === 'archive') archiveMutation.mutate();
    else unarchiveMutation.mutate();
  };

  const renderAction = (kind: 'trash' | 'restore' | 'archive' | 'unarchive', progress: SwipeProgress) => {
    const config = {
      trash: { label: 'Corbeille', icon: Trash2, bg: '#ef4444' },
      restore: { label: 'Restaurer', icon: Undo2, bg: '#10b981' },
      archive: { label: 'Archiver', icon: Archive, bg: '#3b82f6' },
      unarchive: { label: 'Désarchiver', icon: ArchiveRestore, bg: '#3b82f6' },
    }[kind];
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1], extrapolate: 'clamp' });
    return (
      <Animated.View style={{ transform: [{ scale }] }} className="w-20 items-center justify-center rounded-lg" >
        <Pressable
          onPress={() => runAction(kind)}
          style={{ backgroundColor: config.bg }}
          className="h-full w-full items-center justify-center gap-1 rounded-lg"
        >
          <config.icon size={18} color="#fff" />
          <Text className="text-[10px] font-medium text-white">{config.label}</Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      enabled={!selectionMode}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={actions.left ? progress => renderAction(actions.left as 'archive' | 'unarchive' | 'restore', progress) : undefined}
      renderRightActions={actions.right ? progress => renderAction(actions.right as 'trash', progress) : undefined}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        className={`flex-row gap-3 rounded-lg border px-3 py-3 dark:bg-neutral-900 ${selected ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100' : 'border-neutral-200 bg-white dark:border-neutral-800'}`}
      >
        {selectionMode ? (
          <View
            className={`h-10 w-10 items-center justify-center rounded-full border-2 ${selected ? 'border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100' : 'border-neutral-300 dark:border-neutral-600'}`}
          >
            {selected && <Check size={18} color={isDark ? '#111827' : '#fff'} />}
          </View>
        ) : (
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: avatarColor(senderSeed) }}
          >
            <Text className="text-sm font-semibold text-white">{initials(thread.externalFrom || thread.externalEmail)}</Text>
          </View>
        )}
        <View className="flex-1 gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text
              numberOfLines={1}
              className={`flex-1 text-sm ${unread ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'font-medium text-neutral-700 dark:text-neutral-300'}`}
            >
              {thread.externalFrom || thread.externalEmail}
            </Text>
            <Text className="text-[11px] text-neutral-400 dark:text-neutral-500">
              {formatRelativeTime(thread.updatedAt)}
            </Text>
            <Pressable hitSlop={8} onPress={() => starMutation.mutate(!thread.starred)}>
              <Star size={16} color={thread.starred ? '#f59e0b' : '#9ca3af'} fill={thread.starred ? '#f59e0b' : 'none'} />
            </Pressable>
          </View>
          <Text numberOfLines={1} className={`text-sm ${unread ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400'}`}>
            {thread.sujet}
          </Text>
          {thread.lastMessage && (
            <Text numberOfLines={1} className="text-xs text-neutral-400 dark:text-neutral-500">
              {stripHtml(thread.lastMessage.body)}
            </Text>
          )}
          <View className="mt-1 flex-row items-center gap-2">
            <View className={`rounded-full px-2 py-0.5 ${STATUS_CLASS[thread.status]}`}>
              <Text className={`text-[10px] font-medium ${STATUS_CLASS[thread.status]}`}>{STATUS_LABEL[thread.status]}</Text>
            </View>
            {thread.assignedTo && (
              <Text className="text-[11px] text-neutral-400 dark:text-neutral-500">→ {thread.assignedTo.nom}</Text>
            )}
            {unread && <View className="ml-auto h-2 w-2 rounded-full bg-blue-500" />}
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}
