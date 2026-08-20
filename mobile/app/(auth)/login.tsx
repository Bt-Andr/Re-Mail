import { useState } from 'react';
import { Image, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { login as loginRequest, exchangeGoogleHandoff } from '../../src/api/auth';
import { apiFetch, describeError } from '../../src/api/client';
import { describeGoogleSigninError } from '../../src/lib/googleSigninErrors';
import { useSession } from '../../src/context/SessionContext';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';

export default function LoginScreen() {
  const { login } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await loginRequest(username.trim(), password);
      await login(data.token, data.user);
      router.replace('/(app)/(drawer)/inbox');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  // Se connecter directement via Google (comptes perso uniquement) : crée le compte à la
  // volée s'il n'existe pas encore et connecte le Gmail dans la foulée. Tout géré ici
  // même chemin (result.url), pas de route/écran dédié : openAuthSessionAsync intercepte
  // la redirection lui-même (ASWebAuthenticationSession/Custom Tabs), elle ne redéclenche
  // pas forcément le linking global d'expo-router — motif déjà établi dans mailboxes.tsx.
  const continueWithGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const redirectUri = Linking.createURL('google-callback');
      const { url } = await apiFetch<{ url: string }>(`/mailbox-connections/gmail/start-signin?returnTo=${encodeURIComponent(redirectUri)}`);
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
      if (result.type !== 'success' || !result.url) return;

      const parsed = Linking.parse(result.url);
      if (parsed.queryParams?.error) {
        setError(describeGoogleSigninError(String(parsed.queryParams.error)));
        return;
      }
      const handoff = parsed.queryParams?.handoff;
      if (!handoff) {
        setError('La connexion avec Google a échoué.');
        return;
      }
      const data = await exchangeGoogleHandoff(String(handoff));
      await login(data.token, { ...data.user, organization: data.organization });
      router.replace('/(app)/(drawer)/inbox');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-neutral-50 dark:bg-neutral-950"
    >
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-sm gap-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <View className="mb-2 flex-row items-center gap-2.5">
            <Image source={require('../../assets/icon.png')} className="h-7 w-7 rounded-md" />
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Connexion</Text>
          </View>

          <Input
            label="Nom d'utilisateur"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
          <Button onPress={submit} loading={loading}>
            Se connecter
          </Button>

          <View className="flex-row items-center gap-3">
            <View className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            <Text className="text-xs text-neutral-400 dark:text-neutral-500">ou</Text>
            <View className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </View>
          <Button variant="secondary" onPress={continueWithGoogle} loading={googleLoading}>
            Continuer avec Google
          </Button>

          <Link href="/(auth)/activate" asChild>
            <Text className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Invité par un administrateur ?{' '}
              <Text className="font-medium text-neutral-900 dark:text-neutral-100">Activer mon compte</Text>
            </Text>
          </Link>
          <Link href="/(auth)/signup" asChild>
            <Text className="text-center text-xs text-neutral-500 dark:text-neutral-400">
              Pas encore de compte ?{' '}
              <Text className="font-medium text-neutral-900 dark:text-neutral-100">Créer un compte</Text>
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
