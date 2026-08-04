import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Forward, History, Reply } from 'lucide-react-native';
import { useThread } from '../../../src/hooks/useThread';
import { assignThread, setThreadStatus } from '../../../src/api/threads';
import { useSession } from '../../../src/context/SessionContext';
import { MessageBubble } from '../../../src/components/thread/MessageBubble';
import { StatusPicker } from '../../../src/components/thread/StatusPicker';
import { AssignPicker } from '../../../src/components/thread/AssignPicker';
import { ActivityLogModal } from '../../../src/components/thread/ActivityLogModal';
import { Button } from '../../../src/components/ui/Button';
import { ErrorState } from '../../../src/components/ui/EmptyState';
import type { ThreadStatus } from '../../../src/types/api';

function isManager(role?: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { data: thread, isLoading, isError, refetch } = useThread(id);
  const queryClient = useQueryClient();
  const [activityOpen, setActivityOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['thread', id] });
    queryClient.invalidateQueries({ queryKey: ['threads'] });
  };

  const assignMutation = useMutation({
    mutationFn: (userId: string | null) => assignThread(id, userId),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: (status: ThreadStatus) => setThreadStatus(id, status),
    onSuccess: invalidate,
  });

  if (isError) {
    return (
      <View style={{ paddingTop: insets.top }} className="flex-1 bg-white dark:bg-neutral-950">
        <ErrorState onRetry={refetch} />
      </View>
    );
  }

  if (isLoading || !thread) {
    return (
      <View style={{ paddingTop: insets.top }} className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
        <ActivityIndicator />
      </View>
    );
  }

  const lastInbound = [...thread.messages].reverse().find(m => m.direction === 'inbound');

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-white dark:bg-neutral-950">
      <View className="gap-2 border-b border-neutral-200 px-4 pb-3 pt-2 dark:border-neutral-800">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">{thread.sujet}</Text>
          <Pressable onPress={() => setActivityOpen(true)} hitSlop={8} className="p-1">
            <History size={16} color="#9ca3af" />
          </Pressable>
        </View>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          De : {thread.externalFrom} &lt;{thread.externalEmail}&gt;
        </Text>
        <StatusPicker status={thread.status} onChange={s => statusMutation.mutate(s)} />
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-neutral-400 dark:text-neutral-500">Assigné à :</Text>
          {isManager(user?.orgRole) ? (
            <AssignPicker assignedTo={thread.assignedTo} onAssign={userId => assignMutation.mutate(userId)} />
          ) : (
            <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {thread.assignedTo?.nom ?? 'Non assigné'}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-5 p-4">
        {thread.messages.map(m => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </ScrollView>

      <View className="flex-row gap-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button
          variant="secondary"
          className="flex-1 flex-row gap-2"
          onPress={() =>
            router.push({
              pathname: '/(app)/compose',
              params: { mode: 'reply', threadId: thread.id, to: thread.externalEmail, subject: thread.sujet, canal: thread.canal },
            })
          }
        >
          <>
            <Reply size={14} color="#111827" />
            <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Répondre</Text>
          </>
        </Button>
        {lastInbound && (
          <Button
            variant="secondary"
            className="flex-1 flex-row gap-2"
            onPress={() =>
              router.push({
                pathname: '/(app)/compose',
                params: { mode: 'forward', threadId: thread.id, sourceMessageId: lastInbound.id, subject: thread.sujet, canal: thread.canal },
              })
            }
          >
            <>
              <Forward size={14} color="#111827" />
              <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Transférer</Text>
            </>
          </Button>
        )}
      </View>

      <ActivityLogModal open={activityOpen} threadId={thread.id} onClose={() => setActivityOpen(false)} />
    </View>
  );
}
