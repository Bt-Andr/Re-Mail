import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Archive, ArchiveRestore, Tag, Trash2, Undo2, X } from 'lucide-react-native';
import { colors, icons } from '@re-mail/design-tokens';
import { useAccountContext } from '../../hooks/useAccountContext';
import { Modal } from '../ui/Modal';
import type { BulkPatch } from '../../api/threads';
import type { ThreadFolder, ThreadStatus } from '../../types/api';

const STATUS_OPTIONS: { value: ThreadStatus; label: string }[] = [
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'resolu', label: 'Résolu' },
];

// Remplace le bouton "Filtres" de FolderScreen pendant une sélection multiple
// (appui long sur une ligne) — mêmes actions que la barre équivalente côté web
// (BulkActionBar.tsx), adaptées à l'espace écran mobile (statut via une modale
// plutôt que 3 boutons côte à côte).
export function SelectionBar({
  folder,
  count,
  onClear,
  onAction,
}: {
  folder: ThreadFolder;
  count: number;
  onClear: () => void;
  onAction: (patch: BulkPatch) => void;
}) {
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? colors.dark.foreground : colors.light.foreground;
  const [statusOpen, setStatusOpen] = useState(false);
  const { isSoloTeam } = useAccountContext();

  return (
    <View className="flex-row items-center gap-3 border-b border-neutral-200 px-4 pb-3 pt-3 dark:border-neutral-800">
      <Pressable onPress={onClear} hitSlop={8}>
        <X size={icons.swipeAction.sm} color={iconColor} />
      </Pressable>
      <Text className="flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">{count} sélectionné{count > 1 ? 's' : ''}</Text>

      {folder === 'trash' ? (
        <Pressable onPress={() => onAction({ deletedAt: false })} hitSlop={8}>
          <Undo2 size={icons.swipeAction.sm} color={iconColor} />
        </Pressable>
      ) : (
        <>
          {!isSoloTeam && (
            <Pressable onPress={() => setStatusOpen(true)} hitSlop={8}>
              <Tag size={icons.swipeAction.sm} color={iconColor} />
            </Pressable>
          )}
          <Pressable onPress={() => onAction({ archivedAt: folder !== 'archive' })} hitSlop={8}>
            {folder === 'archive' ? <ArchiveRestore size={icons.swipeAction.sm} color={iconColor} /> : <Archive size={icons.swipeAction.sm} color={iconColor} />}
          </Pressable>
          <Pressable onPress={() => onAction({ deletedAt: true })} hitSlop={8}>
            <Trash2 size={icons.swipeAction.sm} color="#ef4444" />
          </Pressable>
        </>
      )}

      <Modal open={statusOpen} title="Changer le statut" onClose={() => setStatusOpen(false)}>
        <View className="gap-1">
          {STATUS_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              onPress={() => {
                setStatusOpen(false);
                onAction({ status: opt.value });
              }}
              className="rounded-lg px-4 py-3.5"
            >
              <Text className="text-base font-medium text-neutral-700 dark:text-neutral-300">{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}
