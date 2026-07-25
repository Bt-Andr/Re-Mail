import { Pressable, Text, View } from 'react-native';
import type { ThreadStatus } from '../../types/api';

const OPTIONS: { id: ThreadStatus; label: string }[] = [
  { id: 'nouveau', label: 'Nouveau' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'resolu', label: 'Résolu' },
];

export function StatusPicker({ status, onChange }: { status: ThreadStatus; onChange: (status: ThreadStatus) => void }) {
  return (
    <View className="flex-row gap-1.5">
      {OPTIONS.map(o => {
        const active = status === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            className={`rounded-full border px-2.5 py-1 ${
              active ? 'border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100' : 'border-neutral-200 dark:border-neutral-700'
            }`}
          >
            <Text className={`text-xs ${active ? 'font-medium text-white dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
