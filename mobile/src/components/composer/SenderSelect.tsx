import { ScrollView, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import type { SenderAddress } from '../../types/api';

interface SenderSelectProps {
  senders: SenderAddress[];
  value: string;
  onChange: (email: string) => void;
  disabled?: boolean;
}

export function SenderSelect({ senders, value, onChange, disabled }: SenderSelectProps) {
  if (senders.length <= 1) return null;

  return (
    <View className="gap-1.5">
      <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">De</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
        {senders.map(s => {
          const active = value === s.email;
          return (
            <Pressable
              key={s.email}
              disabled={disabled}
              onPress={() => onChange(s.email)}
              className={`rounded-full border px-3 py-1.5 ${
                active ? 'border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100' : 'border-neutral-200 dark:border-neutral-700'
              } ${disabled ? 'opacity-60' : ''}`}
            >
              <Text className={`text-xs ${active ? 'font-medium text-white dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400'}`}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
