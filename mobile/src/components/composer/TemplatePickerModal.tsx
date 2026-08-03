import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FileText } from 'lucide-react-native';
import { listReplyTemplates } from '../../api/replyTemplates';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { stripHtml } from '../../lib/format';
import type { ReplyTemplate } from '../../types/api';

interface TemplatePickerModalProps {
  open: boolean;
  canal?: string;
  onClose: () => void;
  onPick: (template: ReplyTemplate) => void;
}

export function TemplatePickerModal({ open, canal, onClose, onPick }: TemplatePickerModalProps) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['reply-templates', canal ?? 'all'],
    queryFn: () => listReplyTemplates(canal),
    enabled: open,
  });

  return (
    <Modal open={open} title="Insérer un modèle" onClose={onClose}>
      {isLoading ? (
        <ActivityIndicator />
      ) : templates.length === 0 ? (
        <EmptyState icon={FileText} label="Aucun modèle de réponse disponible" />
      ) : (
        <View className="gap-2">
          {templates.map(t => (
            <Pressable
              key={t.id}
              onPress={() => onPick(t)}
              className="gap-1 rounded-lg border border-neutral-200 p-3 active:opacity-70 dark:border-neutral-700"
            >
              <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{t.titre}</Text>
              <Text numberOfLines={2} className="text-xs text-neutral-500 dark:text-neutral-400">
                {stripHtml(t.corps)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Modal>
  );
}
