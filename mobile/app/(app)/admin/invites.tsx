import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Download, KeyRound, Plus, UserPlus } from 'lucide-react-native';
import { downloadInviteFile, listInvites, revokeInvite } from '../../../src/api/invites.admin';
import { formatDateTime } from '../../../src/lib/format';
import { Button } from '../../../src/components/ui/Button';
import { Badge, statusBadgeColor } from '../../../src/components/ui/Badge';
import { ErrorState } from '../../../src/components/ui/EmptyState';
import { CreateInviteModal } from '../../../src/components/admin/CreateInviteModal';
import { ActivationCodeModal } from '../../../src/components/admin/ActivationCodeModal';
import type { UserInvite } from '../../../src/types/api';

const STATUS_LABEL: Record<string, string> = { PENDING: 'En attente', ACTIVATED: 'Activée', REVOKED: 'Révoquée' };

export default function InvitesScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: invites = [], isLoading, isError, refetch } = useQuery({ queryKey: ['invites'], queryFn: listInvites });
  const [createOpen, setCreateOpen] = useState(false);
  const [codeFor, setCodeFor] = useState<UserInvite | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['invites'] });

  const revokeMutation = useMutation({ mutationFn: (id: string) => revokeInvite(id), onSuccess: invalidate });

  const confirmRevoke = (invite: UserInvite) => {
    Alert.alert('Révoquer cette invitation ?', `${invite.username} ne pourra plus l'utiliser pour activer un compte.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Révoquer', style: 'destructive', onPress: () => revokeMutation.mutate(invite.id) },
    ]);
  };

  const download = async (invite: UserInvite) => {
    try {
      const uri = await downloadInviteFile(invite.id, `activation-${invite.username}.jep`);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { dialogTitle: 'Fichier d\'activation' });
    } catch {
      Alert.alert('Erreur', 'Téléchargement impossible.');
    }
  };

  return (
    <View style={{ paddingBottom: insets.bottom }} className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <View className="flex-row items-center justify-between gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <Text className="flex-1 text-xs text-neutral-500 dark:text-neutral-400">
          Onboarding par fichier + code : deux secrets envoyés séparément.
        </Text>
        <Button className="flex-row gap-1.5 px-3" onPress={() => setCreateOpen(true)}>
          <>
            <Plus size={14} color="#fff" />
            <Text className="text-sm font-medium text-white dark:text-neutral-900">Inviter</Text>
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
          data={invites}
          keyExtractor={i => i.id}
          contentContainerClassName="gap-3 p-4"
          ListEmptyComponent={
            <View className="items-center gap-2 py-16">
              <UserPlus size={28} color="#9ca3af" />
              <Text className="text-sm text-neutral-400 dark:text-neutral-500">Aucune invitation</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="gap-2 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.nom}</Text>
                <Badge color={statusBadgeColor(item.status)}>{STATUS_LABEL[item.status]}</Badge>
              </View>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {item.username} · {item.email}
              </Text>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500">Expire le {formatDateTime(item.expiresAt)}</Text>
              {item.status === 'PENDING' && (
                <View className="flex-row gap-4 pt-1">
                  <Pressable onPress={() => download(item)} className="flex-row items-center gap-1.5">
                    <Download size={14} color="#6b7280" />
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">Fichier</Text>
                  </Pressable>
                  <Pressable onPress={() => setCodeFor(item)} className="flex-row items-center gap-1.5">
                    <KeyRound size={14} color="#6b7280" />
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">Code</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmRevoke(item)} className="flex-row items-center gap-1.5">
                    <Ban size={14} color="#ef4444" />
                    <Text className="text-xs text-red-600">Révoquer</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      )}

      <CreateInviteModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={emailSent => {
          setCreateOpen(false);
          invalidate();
          if (!emailSent) {
            Alert.alert(
              "Invitation créée",
              "L'email n'a pas pu être envoyé (connectez Resend et renseignez un email de contact dans Organisation). Utilisez Fichier + Code en attendant."
            );
          }
        }}
      />
      <ActivationCodeModal invite={codeFor} onClose={() => setCodeFor(null)} />
    </View>
  );
}
