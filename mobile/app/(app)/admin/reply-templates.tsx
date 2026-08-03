import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { deleteReplyTemplate, listReplyTemplates } from '../../../src/api/replyTemplates';
import { ReplyTemplateFormModal } from '../../../src/components/admin/ReplyTemplateFormModal';
import { Button } from '../../../src/components/ui/Button';
import { EmptyState, ErrorState } from '../../../src/components/ui/EmptyState';
import { stripHtml } from '../../../src/lib/format';
import type { ReplyTemplate } from '../../../src/types/api';

export default function ReplyTemplatesScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading, isError, refetch } = useQuery({ queryKey: ['reply-templates', 'all'], queryFn: () => listReplyTemplates() });
  const [modal, setModal] = useState<{ open: boolean; editing: ReplyTemplate | null }>({ open: false, editing: null });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reply-templates'] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReplyTemplate(id),
    onSuccess: invalidate,
  });

  const confirmDelete = (template: ReplyTemplate) => {
    Alert.alert('Supprimer ce modèle ?', template.titre, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate(template.id) },
    ]);
  };

  return (
    <View style={{ paddingBottom: insets.bottom }} className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <View className="flex-row items-center justify-between gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <Text className="flex-1 text-xs text-neutral-500 dark:text-neutral-400">
          Réponses pré-rédigées proposées dans le composeur, par canal ou pour tous.
        </Text>
        <Button className="flex-row gap-1.5 px-3" onPress={() => setModal({ open: true, editing: null })}>
          <>
            <Plus size={14} color="#fff" />
            <Text className="text-sm font-medium text-white dark:text-neutral-900">Ajouter</Text>
          </>
        </Button>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <FlatList
          data={templates}
          keyExtractor={t => t.id}
          contentContainerClassName="gap-3 p-4"
          ListEmptyComponent={<EmptyState icon={FileText} label="Aucun modèle de réponse" />}
          renderItem={({ item }) => (
            <View className="flex-row items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <View className="flex-1 gap-1">
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.titre}</Text>
                  <Text className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    {item.canal ?? 'Tous canaux'}
                  </Text>
                </View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400" numberOfLines={2}>
                  {stripHtml(item.corps)}
                </Text>
              </View>
              <Pressable onPress={() => setModal({ open: true, editing: item })} hitSlop={8} className="p-1.5">
                <Pencil size={16} color="#9ca3af" />
              </Pressable>
              <Pressable onPress={() => confirmDelete(item)} hitSlop={8} className="p-1.5">
                <Trash2 size={16} color="#9ca3af" />
              </Pressable>
            </View>
          )}
        />
      )}

      <ReplyTemplateFormModal
        open={modal.open}
        editing={modal.editing}
        onClose={() => setModal({ open: false, editing: null })}
        onSaved={() => {
          setModal({ open: false, editing: null });
          invalidate();
        }}
      />
    </View>
  );
}
