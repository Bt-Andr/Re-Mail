import { Linking, Pressable, Text, View } from 'react-native';
import { Paperclip } from 'lucide-react-native';
import { formatDateTime, formatFileSize, initials, stripHtml } from '../../lib/format';
import type { ThreadMessage } from '../../types/api';

export function MessageBubble({ message }: { message: ThreadMessage }) {
  const isOut = message.direction === 'outbound';
  const displayName = isOut ? message.sentBy?.nom ?? message.fromName : message.fromName;

  return (
    <View className={`flex-row gap-3 ${isOut ? 'flex-row-reverse' : ''}`}>
      <View
        className={`h-8 w-8 items-center justify-center rounded-full ${
          isOut ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-neutral-200 dark:bg-neutral-700'
        }`}
      >
        <Text className={`text-xs font-semibold ${isOut ? 'text-white dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-300'}`}>
          {initials(displayName)}
        </Text>
      </View>
      <View className="flex-1 gap-1">
        <View className={`flex-row items-center gap-2 ${isOut ? 'justify-end' : ''}`}>
          <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{displayName}</Text>
          <Text className="text-xs text-neutral-400 dark:text-neutral-500">{formatDateTime(message.sentAt)}</Text>
        </View>
        <View
          className={`self-start rounded-lg px-4 py-3 ${
            isOut ? 'self-end bg-neutral-100 dark:bg-neutral-800' : 'bg-neutral-100 dark:bg-neutral-800'
          }`}
        >
          <Text className="text-sm text-neutral-900 dark:text-neutral-100">{stripHtml(message.body)}</Text>
        </View>
        {message.attachments.length > 0 && (
          <View className={`flex-row flex-wrap gap-2 ${isOut ? 'justify-end' : ''}`}>
            {message.attachments.map(a => (
              <Pressable
                key={a.id}
                onPress={() => Linking.openURL(a.url)}
                className="flex-row items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <Paperclip size={11} color="#9ca3af" />
                <Text numberOfLines={1} className="max-w-[140px] text-xs text-neutral-500 dark:text-neutral-400">
                  {a.filename}
                </Text>
                <Text className="text-xs text-neutral-400 dark:text-neutral-500">{formatFileSize(a.size)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
