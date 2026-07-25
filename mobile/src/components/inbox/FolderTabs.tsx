import { Pressable, Text, View } from 'react-native';
import { Inbox, Send, Trash2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import type { ThreadFolder } from '../../types/api';

interface FolderTabsProps {
  folder: ThreadFolder;
  unreadCount: number;
  onChange: (folder: ThreadFolder) => void;
}

const TABS: { id: ThreadFolder; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: 'Réception', icon: Inbox },
  { id: 'sent', label: 'Envoyés', icon: Send },
  { id: 'trash', label: 'Corbeille', icon: Trash2 },
];

export function FolderTabs({ folder, unreadCount, onChange }: FolderTabsProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-row gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
      {TABS.map(tab => {
        const active = folder === tab.id;
        const iconColor = active ? (isDark ? '#f5f5f5' : '#111827') : isDark ? '#6b7280' : '#9ca3af';
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-md px-2 py-2 ${
              active ? 'bg-white shadow-sm dark:bg-neutral-700' : ''
            }`}
          >
            <tab.icon size={12} color={iconColor} />
            <Text className={`text-xs ${active ? 'font-medium text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400'}`}>
              {tab.label}
            </Text>
            {tab.id === 'inbox' && unreadCount > 0 && (
              <View className="rounded-full bg-neutral-900 px-1.5 py-0.5 dark:bg-neutral-100">
                <Text className="text-[10px] font-bold leading-none text-white dark:text-neutral-900">{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
