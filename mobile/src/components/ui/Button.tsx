import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  children: ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-neutral-900 dark:bg-neutral-100 active:opacity-80',
  secondary: 'bg-neutral-100 dark:bg-neutral-800 active:opacity-80',
  destructive: 'bg-red-600 active:opacity-80',
  ghost: 'bg-transparent active:opacity-60',
};

const VARIANT_TEXT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'text-white dark:text-neutral-900',
  secondary: 'text-neutral-900 dark:text-neutral-100',
  destructive: 'text-white',
  ghost: 'text-neutral-900 dark:text-neutral-100',
};

export function Button({ children, loading, variant = 'primary', disabled, className, ...rest }: ButtonProps & { className?: string }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-lg px-4 py-3 ${VARIANT_CLASSES[variant]} ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}
      {...rest}
    >
      {loading && <ActivityIndicator className="mr-2" color={variant === 'primary' ? '#fff' : '#000'} />}
      {typeof children === 'string' ? (
        <Text className={`text-sm font-medium ${VARIANT_TEXT_CLASSES[variant]}`}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
