import type { ReactNode } from 'react';
import { Modal as RNModal, Pressable, ScrollView, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

export function Modal({ open, title, onClose, footer, children }: ModalProps) {
  return (
    <RNModal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="max-h-[85%] gap-4 rounded-t-xl bg-white p-5 dark:bg-neutral-900"
          onPress={e => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={18} color="#9ca3af" />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="gap-4">{children}</ScrollView>
          {footer && <View className="flex-row gap-3">{footer}</View>}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
