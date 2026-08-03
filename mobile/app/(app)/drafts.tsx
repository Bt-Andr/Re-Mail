import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileEdit, Trash2 } from 'lucide-react-native';
import { deleteDraft, listDrafts } from '../../src/api/drafts';
import { EmptyState, ErrorState } from '../../src/components/ui/EmptyState';
import { formatRelativeTime, stripHtml } from '../../src/lib/format';
import type { MailDraft } from '../../src/types/api';

export default function DraftsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: drafts = [], isLoading, isError, refetch, isRefetching } = useQuery({ queryKey: ['drafts'], queryFn: listDrafts });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDraft(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drafts'] }),
  });

  const confirmDelete = (draft: MailDraft) => {
    Alert.alert('Supprimer ce brouillon ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate(draft.id) },
    ]);
  };

  const resume = (draft: MailDraft) => {
    router.push({
      pathname: '/(app)/compose',
      params: {
        mode: 'new',
        draftId: draft.id,
        to: draft.toEmail,
        ccEmail: draft.ccEmail,
        bccEmail: draft.bccEmail,
        subject: draft.subject,
        body: draft.body,
      },
    });
  };

  return (
    <View style={{ paddingBottom: insets.bottom }} className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={d => d.id}
          contentContainerClassName="gap-3 p-4"
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<EmptyState icon={FileEdit} label="Aucun brouillon" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => resume(item)}
              className="flex-row items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <View className="flex-1 gap-1">
                <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100" numberOfLines={1}>
                  {item.subject.trim() || '(Sans objet)'}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400" numberOfLines={1}>
                  {item.toEmail.trim() ? `À : ${item.toEmail}` : 'Aucun destinataire'}
                </Text>
                {item.body.trim() ? (
                  <Text className="text-xs text-neutral-400 dark:text-neutral-500" numberOfLines={1}>
                    {stripHtml(item.body)}
                  </Text>
                ) : null}
                <Text className="text-[11px] text-neutral-400 dark:text-neutral-500">Modifié {formatRelativeTime(item.updatedAt)}</Text>
              </View>
              <Pressable onPress={() => confirmDelete(item)} hitSlop={8} className="p-1.5">
                <Trash2 size={16} color="#9ca3af" />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
