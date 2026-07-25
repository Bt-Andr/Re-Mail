import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { Check } from 'lucide-react-native';
import { listMailRoutes } from '../../api/mailRoutes';
import { updateSenderGrants } from '../../api/users';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { OrgUser } from '../../types/api';

interface SenderGrantsModalProps {
  user: OrgUser | null;
  onClose: () => void;
  onSaved: (user: OrgUser) => void;
}

export function SenderGrantsModal({ user, onClose, onSaved }: SenderGrantsModalProps) {
  const { data: routes = [], isLoading } = useQuery({ queryKey: ['mail-routes'], queryFn: listMailRoutes, enabled: !!user });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { colorScheme } = useColorScheme();
  const checkColor = colorScheme === 'dark' ? '#111827' : '#fff';

  useEffect(() => {
    if (user) setSelected(new Set(user.senderGrants.map(g => g.email.toLowerCase())));
  }, [user]);

  if (!user) return null;

  const toggle = (alias: string) => {
    const key = alias.toLowerCase();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateSenderGrants(user.id, [...selected]);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  };

  const activeRoutes = routes.filter(r => r.active);

  return (
    <Modal
      open
      title={`Permissions d'envoi — ${user.nom}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onPress={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" onPress={save} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      {isLoading && <ActivityIndicator />}
      {!isLoading && activeRoutes.length === 0 && (
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          Aucune adresse configurée. Ajoutez-en depuis « Adresses mail ».
        </Text>
      )}
      {!isLoading &&
        activeRoutes.map(r => {
          const checked = selected.has(r.alias.toLowerCase());
          return (
            <Pressable
              key={r.id}
              onPress={() => toggle(r.alias)}
              className="flex-row items-center gap-2.5 rounded-md border border-neutral-200 px-3 py-2.5 dark:border-neutral-700"
            >
              <View
                className={`h-4 w-4 items-center justify-center rounded border ${
                  checked ? 'border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100' : 'border-neutral-300 dark:border-neutral-600'
                }`}
              >
                {checked && <Check size={11} color={checkColor} />}
              </View>
              <Text className="font-mono text-sm text-neutral-900 dark:text-neutral-100">{r.alias}</Text>
              {r.displayName && <Text className="text-xs text-neutral-500 dark:text-neutral-400">({r.displayName})</Text>}
            </Pressable>
          );
        })}
    </Modal>
  );
}
