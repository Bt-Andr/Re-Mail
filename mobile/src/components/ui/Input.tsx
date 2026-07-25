import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label: string;
}

export function Input({ label, className, ...rest }: InputProps & { className?: string }) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</Text>
      <TextInput
        placeholderTextColor="#9ca3af"
        className={`rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 ${className ?? ''}`}
        {...rest}
      />
    </View>
  );
}
