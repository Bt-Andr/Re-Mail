import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { ChevronRight, Building2, Users } from 'lucide-react-native';
import { exchangeGoogleHandoff } from '../../src/api/auth';
import { apiFetch, describeError } from '../../src/api/client';
import { describeGoogleSigninError } from '../../src/lib/googleSigninErrors';
import { useSession } from '../../src/context/SessionContext';
import { MailboxConnectionFormModal, MAILBOX_PRESETS } from '../../src/components/mailboxes/MailboxConnectionFormModal';
import { CreateEnterpriseFlow } from '../../src/components/mailboxes/CreateEnterpriseFlow';
import { BASE_PROVIDERS, type BaseMailboxProvider } from '../../src/components/mailboxes/providerList';

type WelcomeProvider = BaseMailboxProvider | 'create-enterprise' | 'join-enterprise';

// Écran d'accueil non connecté : choisir un service de messagerie crée le compte ET
// connecte la première boîte en une seule étape (comme "Continuer avec Google" le
// fait déjà) — Re-Mail est un client mail générique. Le formulaire classique reste
// accessible via le lien discret en bas (login.tsx, inchangé).
const ENTRIES: { id: WelcomeProvider; label: string; icon: React.ReactElement }[] = [
  ...BASE_PROVIDERS.filter(p => p.id !== 'other'),
  { id: 'create-enterprise', label: 'Créer une entreprise', icon: <Building2 size={20} color="#9ca3af" /> },
  { id: 'join-enterprise', label: 'Rejoindre une entreprise', icon: <Users size={20} color="#9ca3af" /> },
  ...BASE_PROVIDERS.filter(p => p.id === 'other'),
];

export default function WelcomeScreen() {
  const { login } = useSession();
  const params = useLocalSearchParams<{ error?: string }>();
  const [googleLoading, setGoogleLoading] = useState(false);
  // Peut arriver déjà rempli si on revient ici depuis le filet de sécurité
  // google-callback.tsx (deep link qui a "fui" hors de l'interception normale de
  // openAuthSessionAsync — voir ce fichier pour le détail).
  const [error, setError] = useState(params.error ? describeGoogleSigninError(params.error) : '');
  const [formOpen, setFormOpen] = useState(false);
  const [formPreset, setFormPreset] = useState<Partial<(typeof MAILBOX_PRESETS)[string]> | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);

  // Identique à (auth)/login.tsx et (auth)/signup.tsx (non touchés, voir plan) —
  // dupliqué ici plutôt que partagé, pour ne rien risquer sur ces deux écrans.
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

  const selectProvider = (id: WelcomeProvider) => {
    setError('');
    if (id === 'google') {
      void continueWithGoogle();
      return;
    }
    if (id === 'create-enterprise') {
      setCreateOpen(true);
      return;
    }
    if (id === 'join-enterprise') {
      router.push('/(auth)/activate');
      return;
    }
    setFormPreset(id === 'other' ? undefined : MAILBOX_PRESETS[id]);
    setFormOpen(true);
  };

  return (
    <ScrollView contentContainerClassName="grow items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
      <View className="w-full max-w-sm gap-1 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <View className="mb-1 flex-row items-center gap-2.5">
          <Image source={require('../../assets/icon.png')} className="h-7 w-7 rounded-md" />
          <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Bienvenue sur Re-Mail</Text>
        </View>
        <Text className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Choisissez le service de messagerie à connecter.</Text>

        <View className="-mx-6 border-t border-neutral-200 dark:border-neutral-800">
          {ENTRIES.map(entry => (
            <Pressable
              key={entry.id}
              onPress={() => selectProvider(entry.id)}
              disabled={entry.id === 'google' && googleLoading}
              className="flex-row items-center gap-3 border-b border-neutral-200 px-6 py-3.5 dark:border-neutral-800"
            >
              {entry.icon}
              <Text className="flex-1 text-sm text-neutral-900 dark:text-neutral-100">{entry.label}</Text>
              <ChevronRight size={16} color="#9ca3af" />
            </Pressable>
          ))}
        </View>

        {error ? <Text className="mt-3 text-xs text-red-600">{error}</Text> : null}

        <Link href="/(auth)/login" asChild>
          <Text className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
            <Text className="font-medium text-neutral-900 dark:text-neutral-100">Se connecter avec nom d'utilisateur / mot de passe</Text>
          </Text>
        </Link>
      </View>

      <MailboxConnectionFormModal
        open={formOpen}
        mode="signin"
        preset={formPreset}
        onClose={() => setFormOpen(false)}
        onSaved={() => setFormOpen(false)}
      />
      <CreateEnterpriseFlow open={createOpen} onClose={() => setCreateOpen(false)} />
    </ScrollView>
  );
}
