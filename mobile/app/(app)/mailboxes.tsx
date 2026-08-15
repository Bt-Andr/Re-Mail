import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, RefreshCw, Trash2 } from 'lucide-react-native';
import { deleteMailboxConnection, listMailboxConnections, retryMailboxConnection } from '../../src/api/mailboxConnections';
import { apiFetch, describeError } from '../../src/api/client';
import { MailboxConnectionFormModal, MAILBOX_PRESETS } from '../../src/components/mailboxes/MailboxConnectionFormModal';
import { ProviderPickerSheet, type MailboxProvider } from '../../src/components/mailboxes/ProviderPickerSheet';
import { ResendConnectSheet } from '../../src/components/mailboxes/ResendConnectSheet';
import { useAccountSwitcher } from '../../src/context/AccountSwitcherContext';
import { useAccountContext } from '../../src/hooks/useAccountContext';
import { Button } from '../../src/components/ui/Button';
import { ErrorState } from '../../src/components/ui/EmptyState';
import type { ExternalMailboxConnection } from '../../src/types/api';

// Accessible à TOUT utilisateur authentifié (pas seulement OWNER/ADMIN) — c'est un
// identifiant personnel, pas une ressource d'équipe comme les adresses mail de l'org
// (voir admin/mail-routes.tsx) : ne vit donc pas sous admin/, volontairement pas de
// useAdminGuard() ici.
export default function MailboxesScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: connections = [], isLoading, isError, refetch } = useQuery({ queryKey: ['mailbox-connections'], queryFn: listMailboxConnections });
  const { refetch: refetchAccounts } = useAccountSwitcher();
  const { isManager } = useAccountContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formPreset, setFormPreset] = useState<Partial<(typeof MAILBOX_PRESETS)[string]> | undefined>(undefined);
  const [connectingGmail, setConnectingGmail] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['mailbox-connections'] });
    refetchAccounts();
  };

  const retryMutation = useMutation({ mutationFn: (id: string) => retryMailboxConnection(id), onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: (id: string) => deleteMailboxConnection(id), onSuccess: invalidate });

  const connectGmail = async () => {
    setConnectingGmail(true);
    try {
      // Résout en re-mail://mailboxes dans un vrai build, en exp://... (proxy Expo Go) en
      // dev — le backend accepte les deux (voir isAllowedReturnTo côté serveur).
      const redirectUri = Linking.createURL('mailboxes');
      const { url } = await apiFetch<{ url: string }>(`/mailbox-connections/gmail/start?returnTo=${encodeURIComponent(redirectUri)}`);
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        if (parsed.queryParams?.error) {
          Alert.alert('Connexion Gmail échouée', String(parsed.queryParams.error));
        } else {
          invalidate();
        }
      }
    } catch (e) {
      Alert.alert('Erreur', describeError(e));
    } finally {
      setConnectingGmail(false);
    }
  };

  const selectProvider = (provider: MailboxProvider) => {
    setPickerOpen(false);
    if (provider === 'google') {
      void connectGmail();
      return;
    }
    if (provider === 'resend') {
      setResendOpen(true);
      return;
    }
    setFormPreset(provider === 'other' ? undefined : MAILBOX_PRESETS[provider]);
    setFormOpen(true);
  };

  const confirmDelete = (connection: ExternalMailboxConnection) => {
    Alert.alert('Déconnecter cette boîte ?', `${connection.email} ne sera plus consultable dans l'app.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => deleteMutation.mutate(connection.id) },
    ]);
  };

  return (
    <View style={{ paddingBottom: insets.bottom }} className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <View className="gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-xs text-neutral-500 dark:text-neutral-400">
            Connectez un Gmail, Outlook ou toute autre boîte mail existante.
          </Text>
        </View>
        <Button className="flex-row items-center gap-1.5 px-3 self-start" onPress={() => setPickerOpen(true)} loading={connectingGmail}>
          <>
            <Plus size={14} color="#fff" />
            <Text className="text-sm font-medium text-white dark:text-neutral-900">Connecter</Text>
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
          data={connections}
          keyExtractor={c => c.id}
          contentContainerClassName="gap-3 p-4"
          ListEmptyComponent={
            <View className="items-center gap-2 py-16">
              <Mail size={28} color="#9ca3af" />
              <Text className="text-sm text-neutral-400 dark:text-neutral-500">Aucune boîte connectée</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <Mail size={18} color="#6b7280" />
              </View>
              <View className="flex-1 gap-1">
                <Text className="font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.email}</Text>
                <View className="flex-row items-center gap-1.5">
                  <Text
                    className={`self-start rounded-full px-2 py-0.5 text-xs ${
                      item.status === 'connected'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-500/10 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {item.status === 'connected' ? 'Connectée' : 'Erreur'}
                  </Text>
                </View>
                {item.status === 'error' && item.lastError && (
                  <Text className="text-xs text-red-600 dark:text-red-400">{item.lastError}</Text>
                )}
              </View>
              {item.status === 'error' && (
                <Pressable onPress={() => retryMutation.mutate(item.id)} hitSlop={8} className="p-1.5">
                  <RefreshCw size={16} color="#9ca3af" />
                </Pressable>
              )}
              <Pressable onPress={() => confirmDelete(item)} hitSlop={8} className="p-1.5">
                <Trash2 size={16} color="#9ca3af" />
              </Pressable>
            </View>
          )}
        />
      )}

      <ProviderPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={selectProvider} showResend={isManager} />
      <ResendConnectSheet
        open={resendOpen}
        onClose={() => setResendOpen(false)}
        onConnected={() => {
          Alert.alert('Resend connecté');
          refetchAccounts();
        }}
      />
      <MailboxConnectionFormModal
        open={formOpen}
        preset={formPreset}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          invalidate();
        }}
      />
    </View>
  );
}
