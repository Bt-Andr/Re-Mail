import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { exchangeGoogleHandoff } from '../src/api/auth';
import { describeError } from '../src/api/client';
import { useSession } from '../src/context/SessionContext';

// Filet de sécurité pour le deep link re-mail://google-callback : login.tsx/signup.tsx/
// welcome.tsx interceptent normalement ce retour directement via la promesse
// d'expo-web-browser (openAuthSessionAsync), sans jamais faire naviguer le routeur
// jusqu'ici. Mais sur Android, cette interception n'est pas garantie fiable à 100% —
// si le lien "fuit" vers le gestionnaire de deep links générique de l'OS, Expo Router
// tente de résoudre /google-callback comme une route normale, et sans cet écran ça
// tombait sur "Unmatched Route" (aucun exchange tenté, l'utilisateur ne sait jamais
// pourquoi). Reprend ici la même logique d'échange que les écrans d'auth.
export default function GoogleCallbackScreen() {
  const { login, user } = useSession();
  const params = useLocalSearchParams<{ error?: string; handoff?: string }>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // Une session existe déjà : l'interception normale (openAuthSessionAsync dans
    // welcome.tsx/login.tsx/signup.tsx) a déjà gagné la course et consommé le jeton
    // d'échange avant que ce filet de sécurité ne s'exécute. Retenter l'échange ici
    // échouerait à coup sûr (jeton à usage unique déjà utilisé) pour rien — direction
    // l'inbox plutôt que de solliciter le backend inutilement.
    if (user) {
      router.replace('/(app)/(drawer)/inbox');
      return;
    }

    if (params.error) {
      router.replace({ pathname: '/(auth)/welcome', params: { error: String(params.error) } });
      return;
    }
    if (!params.handoff) {
      router.replace({ pathname: '/(auth)/welcome', params: { error: 'La connexion avec Google a échoué.' } });
      return;
    }

    exchangeGoogleHandoff(String(params.handoff))
      .then(async data => {
        await login(data.token, { ...data.user, organization: data.organization });
        router.replace('/(app)/(drawer)/inbox');
      })
      .catch(e => {
        router.replace({ pathname: '/(auth)/welcome', params: { error: describeError(e) } });
      });
  }, [params.error, params.handoff, login]);

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-neutral-50 dark:bg-neutral-950">
      <ActivityIndicator />
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">Connexion en cours…</Text>
    </View>
  );
}
