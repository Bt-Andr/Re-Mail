import { Pressable, Text, View } from 'react-native';
import { avatarColor, formatRelativeTime, initials, stripHtml } from '../../lib/format';
import type { Thread } from '../../types/api';

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

export function ThreadListItem({ thread, onPress }: { thread: Thread; onPress: () => void }) {
  const unread = thread.unreadCount > 0;
  const senderSeed = thread.externalEmail || thread.externalFrom;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: avatarColor(senderSeed) }}
      >
        <Text className="text-sm font-semibold text-white">{initials(thread.externalFrom || thread.externalEmail)}</Text>
      </View>
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
  );
}
