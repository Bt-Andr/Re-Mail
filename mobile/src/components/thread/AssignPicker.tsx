import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react-native';
import { listUsers } from '../../api/users';
import type { AssignedTo } from '../../types/api';

interface AssignPickerProps {
  assignedTo: AssignedTo | null;
  onAssign: (userId: string | null) => void;
}

export function AssignPicker({ assignedTo, onAssign }: AssignPickerProps) {
  const [open, setOpen] = useState(false);
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled: open });

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 dark:border-neutral-700"
      >
        <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {assignedTo?.nom ?? 'Non assigné'}
        </Text>
        <ChevronDown size={12} color="#9ca3af" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable className="max-h-96 rounded-t-xl bg-white p-2 dark:bg-neutral-900" onPress={e => e.stopPropagation()}>
            <ScrollView>
              <Pressable
                onPress={() => {
                  onAssign(null);
                  setOpen(false);
                }}
                className="rounded-md px-4 py-3"
              >
                <Text className="text-sm italic text-neutral-400 dark:text-neutral-500">— Non assigné —</Text>
              </Pressable>
              {users.map(u => (
                <Pressable
                  key={u.id}
                  onPress={() => {
                    onAssign(u.id);
                    setOpen(false);
                  }}
                  className="rounded-md px-4 py-3"
                >
                  <Text
                    className={`text-sm ${
                      assignedTo?.id === u.id ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {u.nom}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
