import { Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Paperclip, X } from 'lucide-react-native';
import { formatFileSize } from '../../lib/format';
import type { PickedAttachment } from '../../types/api';

interface AttachmentPickerProps {
  files: PickedAttachment[];
  onChange: (files: PickedAttachment[]) => void;
}

const MAX_FILES = 5;

export function AttachmentPicker({ files, onChange }: AttachmentPickerProps) {
  const pick = async () => {
    if (files.length >= MAX_FILES) return;
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    const picked: PickedAttachment[] = result.assets.map(a => ({
      uri: a.uri,
      name: a.name,
      mimeType: a.mimeType ?? null,
      size: a.size ?? null,
    }));
    onChange([...files, ...picked].slice(0, MAX_FILES));
  };

  return (
    <View className="gap-2">
      <Pressable onPress={pick} className="flex-row items-center gap-1.5 self-start">
        <Paperclip size={13} color="#6b7280" />
        <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Joindre un fichier</Text>
      </Pressable>
      {files.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {files.map((f, i) => (
            <View
              key={`${f.uri}-${i}`}
              className="flex-row items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            >
              <Text numberOfLines={1} className="max-w-[120px] text-xs text-neutral-500 dark:text-neutral-400">
                {f.name}
              </Text>
              {f.size != null && <Text className="text-xs text-neutral-400 dark:text-neutral-500">{formatFileSize(f.size)}</Text>}
              <Pressable onPress={() => onChange(files.filter((_, idx) => idx !== i))}>
                <X size={12} color="#9ca3af" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
