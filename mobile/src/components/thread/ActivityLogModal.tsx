import { ActivityIndicator, Text, View } from 'react-native';
import { History } from 'lucide-react-native';
import { useThreadActivity } from '../../hooks/useThreadActivity';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { formatDateTime } from '../../lib/format';
import type { ThreadActivity, ThreadActivityType } from '../../types/api';

const STATUS_LABEL: Record<string, string> = { nouveau: 'Nouveau', en_cours: 'En cours', resolu: 'Résolu' };

function parsePayload(payload: string | null): Record<string, unknown> {
  if (!payload) return {};
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function describe(activity: ThreadActivity): string {
  const payload = parsePayload(activity.payload);
  const by = (payload.by as string) || activity.user?.nom;
  switch (activity.type as ThreadActivityType) {
    case 'created':
      return `Fil créé depuis un message de ${payload.from ?? payload.email ?? 'un expéditeur externe'}`;
    case 'assigned':
      return `Assigné à ${payload.to ?? '—'}`;
    case 'unassigned':
      return 'Désassigné';
    case 'status_changed':
      return `Statut changé de « ${STATUS_LABEL[payload.from as string] ?? payload.from} » à « ${STATUS_LABEL[payload.to as string] ?? payload.to} »`;
    case 'replied':
      return by ? `Réponse envoyée par ${by}` : 'Réponse envoyée';
    case 'sent':
      return by ? `Nouveau message envoyé par ${by}` : 'Nouveau message envoyé';
    case 'forwarded':
      return by ? `Message transféré par ${by}` : 'Message transféré';
    case 'trashed':
      return 'Déplacé vers la corbeille';
    case 'restored':
      return 'Restauré depuis la corbeille';
    default:
      return activity.type;
  }
}

export function ActivityLogModal({ open, threadId, onClose }: { open: boolean; threadId: string; onClose: () => void }) {
  const { data: activities = [], isLoading } = useThreadActivity(threadId, open);

  return (
    <Modal open={open} title="Activité du fil" onClose={onClose}>
      {isLoading ? (
        <ActivityIndicator />
      ) : activities.length === 0 ? (
        <EmptyState icon={History} label="Aucune activité enregistrée" />
      ) : (
        <View className="gap-3">
          {activities.map(a => (
            <View key={a.id} className="gap-0.5 border-l-2 border-neutral-200 pl-3 dark:border-neutral-700">
              <Text className="text-sm text-neutral-900 dark:text-neutral-100">{describe(a)}</Text>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500">
                {formatDateTime(a.createdAt)}
                {a.user ? ` · ${a.user.nom}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Modal>
  );
}
