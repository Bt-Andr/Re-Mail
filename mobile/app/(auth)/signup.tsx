import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { signup as signupRequest, exchangeGoogleHandoff } from '../../src/api/auth';
import { apiFetch, describeError } from '../../src/api/client';
import { describeGoogleSigninError } from '../../src/lib/googleSigninErrors';
import { useSession } from '../../src/context/SessionContext';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';

// Mobile n'a pas d'équivalent au wizard d'onboarding web (Resend/domaine/webhook) —
// signup dépose directement dans l'inbox, quel que soit le type de compte ; connecter
// un domaine reste une opération à faire depuis le dashboard web pour l'instant.
export default function SignupScreen() {
  const { login } = useSession();
  const [accountType, setAccountType] = useState<'pro' | 'perso'>('pro');
  const [orgName, setOrgName] = useState('');
  const [nom, setNom] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await signupRequest({ accountType, orgName, nom, username: username.trim(), email: email.trim(), password });
      await login(data.token, { ...data.user, organization: data.organization });
      router.replace('/(app)/(drawer)/inbox');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  // Pour un nouveau compte perso, "se connecter avec Google" EST l'inscription — voir
  // (auth)/login.tsx pour le détail de ce même flux (identique ici).
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <ScrollView contentContainerClassName="grow items-center justify-center p-6">
        <View className="w-full max-w-sm gap-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <View className="mb-2 flex-row items-center gap-2.5">
            <Image source={require('../../assets/icon.png')} className="h-7 w-7 rounded-md" />
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Créer un compte</Text>
          </View>

          <View className="flex-row gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
            {(['pro', 'perso'] as const).map(type => (
              <Pressable
                key={type}
                onPress={() => setAccountType(type)}
                className={`flex-1 items-center rounded-md py-2 ${accountType === type ? 'bg-white dark:bg-neutral-950' : ''}`}
              >
                <Text
                  className={`text-xs font-medium ${accountType === type ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400'}`}
                >
                  {type === 'pro' ? 'Équipe' : 'Perso — usage personnel'}
                </Text>
              </Pressable>
            ))}
          </View>

          {accountType === 'pro' && (
            <Input label="Nom de l'organisation" value={orgName} onChangeText={setOrgName} returnKeyType="next" />
          )}
          <Input label="Votre nom" value={nom} onChangeText={setNom} returnKeyType="next" />
          <Input label="Nom d'utilisateur" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
          <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry returnKeyType="done" onSubmitEditing={submit} />
          {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
          <Button
            onPress={submit}
            loading={loading}
            disabled={!nom.trim() || !username.trim() || !email.trim() || !password || (accountType === 'pro' && !orgName.trim())}
          >
            Créer mon compte
          </Button>

          <View className="flex-row items-center gap-3">
            <View className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            <Text className="text-xs text-neutral-400 dark:text-neutral-500">ou</Text>
            <View className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </View>
          <Button variant="secondary" onPress={continueWithGoogle} loading={googleLoading}>
            Continuer avec Google
          </Button>

          <Link href="/(auth)/login" asChild>
            <Text className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Déjà un compte ? <Text className="font-medium text-neutral-900 dark:text-neutral-100">Se connecter</Text>
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
