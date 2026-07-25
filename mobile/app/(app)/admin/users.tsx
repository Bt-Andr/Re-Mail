import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Users as UsersIcon } from 'lucide-react-native';
import { listOrgUsers } from '../../../src/api/users';
import { Badge, type BadgeColor } from '../../../src/components/ui/Badge';
import { SenderGrantsModal } from '../../../src/components/admin/SenderGrantsModal';
import type { OrgRole, OrgUser } from '../../../src/types/api';

const ROLE_LABEL: Record<OrgRole, string> = { OWNER: 'Propriétaire', ADMIN: 'Admin', MEMBER: 'Membre' };
const ROLE_COLOR: Record<OrgRole, BadgeColor> = { OWNER: 'amber', ADMIN: 'blue', MEMBER: 'gray' };

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery({ queryKey: ['org-users'], queryFn: listOrgUsers });
  const [grantsFor, setGrantsFor] = useState<OrgUser | null>(null);

  return (
    <View style={{ paddingBottom: insets.bottom }} className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <View className="border-b border-neutral-200 p-4 dark:border-neutral-800">
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          Membres de l'organisation et permissions d'envoi par adresse.
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerClassName="gap-3 p-4"
          ListEmptyComponent={
            <View className="items-center gap-2 py-16">
              <UsersIcon size={28} color="#9ca3af" />
              <Text className="text-sm text-neutral-400 dark:text-neutral-500">Aucun utilisateur</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <View className="flex-1 gap-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.nom}</Text>
                  <Badge color={ROLE_COLOR[item.orgRole]}>{ROLE_LABEL[item.orgRole]}</Badge>
                </View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  {item.username} · {item.email}
                </Text>
                <Text className="text-xs text-neutral-400 dark:text-neutral-500">
                  {item.orgRole === 'MEMBER'
                    ? item.senderGrants.length > 0
                      ? `Peut envoyer depuis ${item.senderGrants.length} adresse${item.senderGrants.length > 1 ? 's' : ''}`
                      : "Aucune permission d'envoi"
                    : `Accès à toutes les adresses (rôle ${ROLE_LABEL[item.orgRole].toLowerCase()})`}
                </Text>
              </View>
              {item.orgRole === 'MEMBER' && (
                <Pressable onPress={() => setGrantsFor(item)} hitSlop={8} className="p-1.5">
                  <ShieldCheck size={18} color="#9ca3af" />
                </Pressable>
              )}
            </View>
          )}
        />
      )}

      <SenderGrantsModal
        user={grantsFor}
        onClose={() => setGrantsFor(null)}
        onSaved={updated => {
          queryClient.setQueryData<OrgUser[]>(['org-users'], prev => prev?.map(u => (u.id === updated.id ? updated : u)));
          setGrantsFor(null);
        }}
      />
    </View>
  );
}
