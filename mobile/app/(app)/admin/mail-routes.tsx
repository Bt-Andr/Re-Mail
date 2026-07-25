import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { deleteMailRoute, listMailRoutes, updateMailRoute } from '../../../src/api/mailRoutes';
import { MailRouteFormModal } from '../../../src/components/admin/MailRouteFormModal';
import { Button } from '../../../src/components/ui/Button';
import type { MailRoute } from '../../../src/types/api';

export default function MailRoutesScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: routes = [], isLoading } = useQuery({ queryKey: ['mail-routes'], queryFn: listMailRoutes });
  const [modal, setModal] = useState<{ open: boolean; editing: MailRoute | null }>({ open: false, editing: null });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['mail-routes'] });

  const toggleMutation = useMutation({
    mutationFn: (route: MailRoute) => updateMailRoute(route.id, { active: !route.active }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMailRoute(id),
    onSuccess: invalidate,
  });

  const confirmDelete = (route: MailRoute) => {
    Alert.alert('Supprimer cette adresse ?', `${route.alias} ne recevra plus de nouveaux emails.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate(route.id) },
    ]);
  };

  return (
    <View style={{ paddingBottom: insets.bottom }} className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <View className="flex-row items-center justify-between gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <Text className="flex-1 text-xs text-neutral-500 dark:text-neutral-400">
          Alias @votredomaine.com et notification personnelle associée.
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
      ) : (
        <FlatList
          data={routes}
          keyExtractor={r => r.id}
          contentContainerClassName="gap-3 p-4"
          ListEmptyComponent={
            <View className="items-center gap-2 py-16">
              <AtSign size={28} color="#9ca3af" />
              <Text className="text-sm text-neutral-400 dark:text-neutral-500">Aucune adresse configurée</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <AtSign size={18} color="#6b7280" />
              </View>
              <View className="flex-1 gap-1">
                <View className="flex-row flex-wrap items-center gap-1">
                  <Text className="font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.alias}</Text>
                  {item.personalEmail ? (
                    <Text className="font-mono text-xs text-neutral-500 dark:text-neutral-400">→ {item.personalEmail}</Text>
                  ) : (
                    <Text className="text-xs italic text-neutral-400 dark:text-neutral-500">Transfert non configuré</Text>
                  )}
                </View>
                <Pressable onPress={() => toggleMutation.mutate(item)} className="self-start">
                  <Text
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      item.active
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    {item.active ? 'Active' : 'Inactive'}
                  </Text>
                </Pressable>
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

      <MailRouteFormModal
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
