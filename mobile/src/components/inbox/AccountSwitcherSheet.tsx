import { Pressable, Text, View } from 'react-native';
import { Mail, Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Modal } from '../ui/Modal';
import { useAccountSwitcher } from '../../context/AccountSwitcherContext';

export function AccountSwitcherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, selectedAccountId, setSelectedAccountId } = useAccountSwitcher();
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#8b93a1' : '#6b7280';

  return (
    <Modal open={open} title="Comptes" onClose={onClose}>
      <View className="-mx-5 gap-0.5">
        <Pressable
          onPress={() => {
            setSelectedAccountId(null);
            onClose();
          }}
          className="flex-row items-center gap-3 px-5 py-3.5"
        >
          <Mail size={18} color={iconColor} />
          <Text className="flex-1 text-sm text-neutral-900 dark:text-neutral-100">Toutes les boîtes</Text>
          {!selectedAccountId && <Check size={16} color={iconColor} />}
        </Pressable>
        {accounts.map(account => (
          <Pressable
            key={account.id}
            onPress={() => {
              setSelectedAccountId(account.id);
              onClose();
            }}
            className="flex-row items-center gap-3 px-5 py-3.5"
          >
            <Mail size={18} color={iconColor} />
            <Text className="flex-1 text-sm text-neutral-900 dark:text-neutral-100" numberOfLines={1}>
              {account.label}
            </Text>
            {account.status === 'error' && <Text className="text-[10px] text-red-500">Erreur</Text>}
            {selectedAccountId === account.id && <Check size={16} color={iconColor} />}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}
