import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../src/context/SessionContext';

export default function AuthGroupLayout() {
  const { user, loading, pendingOrgIntent } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
        <ActivityIndicator />
      </View>
    );
  }

  // Ne redirige PAS tant qu'un sous-flux "connecter d'abord une identité personnelle"
  // est en cours (welcome.tsx/activate.tsx, voir SessionContext.pendingOrgIntent) : une
  // identité perso vient d'être établie, mais le sous-flux n'est pas terminé — rediriger
  // ici couperait la reprise (ouverture du formulaire entreprise, ou retour à
  // l'activation) avant qu'elle n'ait pu s'exécuter.
  if (user && !pendingOrgIntent) return <Redirect href="/(app)/(drawer)/inbox" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
