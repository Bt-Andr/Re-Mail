import { Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useSession } from '../../context/SessionContext';

export function NoSendersNotice() {
  const { user } = useSession();
  const isManager = user?.orgRole === 'OWNER' || user?.orgRole === 'ADMIN';

  return (
    <View className="flex-row items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
      <AlertTriangle color="#d97706" size={18} />
      <Text className="flex-1 text-sm text-amber-800 dark:text-amber-300">
        {isManager
          ? "Aucune adresse d'expédition disponible. Connectez Resend et créez une adresse d'envoi depuis le dashboard web pour pouvoir écrire."
          : "Aucune adresse d'expédition ne vous est attribuée. Demandez à un administrateur de vous en accorder une."}
      </Text>
    </View>
  );
}
