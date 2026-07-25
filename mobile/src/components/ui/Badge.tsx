import { Text, View } from 'react-native';

const BG_CLASSES = {
  gray: 'bg-neutral-100 dark:bg-neutral-800',
  blue: 'bg-blue-500/10',
  amber: 'bg-amber-500/10',
  green: 'bg-emerald-500/10',
  red: 'bg-red-500/10',
} as const;

const TEXT_CLASSES = {
  gray: 'text-neutral-600 dark:text-neutral-300',
  blue: 'text-blue-700 dark:text-blue-400',
  amber: 'text-amber-700 dark:text-amber-400',
  green: 'text-emerald-700 dark:text-emerald-400',
  red: 'text-red-700 dark:text-red-400',
} as const;

export type BadgeColor = keyof typeof BG_CLASSES;

export function Badge({ color, children }: { color: BadgeColor; children: string }) {
  return (
    <View className={`rounded-full px-2 py-0.5 ${BG_CLASSES[color]}`}>
      <Text className={`text-[11px] font-medium ${TEXT_CLASSES[color]}`}>{children}</Text>
    </View>
  );
}

export function statusBadgeColor(status: string): BadgeColor {
  if (status === 'ACTIVATED') return 'green';
  if (status === 'REVOKED') return 'red';
  return 'amber';
}
