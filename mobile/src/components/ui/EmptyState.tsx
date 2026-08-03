import { Text, View } from 'react-native';
import { AlertTriangle, type LucideIcon } from 'lucide-react-native';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  label: string;
}

export function EmptyState({ icon: Icon, label }: EmptyStateProps) {
  return (
    <View className="items-center gap-2 py-16">
      <Icon size={28} color="#9ca3af" />
      <Text className="text-sm text-neutral-400 dark:text-neutral-500">{label}</Text>
    </View>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

// Utilisé quand une requête réseau échoue (hors-ligne, backend injoignable) — l'écran
// affiche l'erreur avec un bouton pour retenter plutôt qu'une liste vide silencieuse.
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="items-center gap-3 py-16">
      <AlertTriangle size={28} color="#f59e0b" />
      <Text className="max-w-[80%] text-center text-sm text-neutral-400 dark:text-neutral-500">
        {message || 'Impossible de charger ces données.'}
      </Text>
      <Button variant="secondary" onPress={onRetry} className="px-4">
        Réessayer
      </Button>
    </View>
  );
}
