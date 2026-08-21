import { useEffect, useState } from 'react';
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

// Marqueurs reconnus par CET écran (voir SessionContext.pendingOrgIntent) — distinct du
// marqueur posé par (auth)/activate.tsx quand IL pousse cet écran en attendant son
// propre retour (router.back()) : celui-là n'est pas à nous, on ne doit pas y toucher.
type WelcomeIntent = 'create-enterprise' | 'join-enterprise';
function isWelcomeIntent(v: string | null): v is WelcomeIntent {
  return v === 'create-enterprise' || v === 'join-enterprise';
}

export default function WelcomeScreen() {
  const { login, hasPersonalAccount, pendingOrgIntent, setPendingOrgIntent } = useSession();
  const params = useLocalSearchParams<{ error?: string; suppressAutoNav?: string }>();
  // Poussé ici depuis (auth)/activate.tsx en attente d'une identité personnelle : cet
  // écran reste empilé en dessous (voir router.back() dans activate.tsx) — ne pas
  // rediriger vers l'inbox une fois connecté, le laisser reprendre la main lui-même.
  const suppressAutoNav = params.suppressAutoNav === '1';
  const [googleLoading, setGoogleLoading] = useState(false);
  // Peut arriver déjà rempli si on revient ici depuis le filet de sécurité
  // google-callback.tsx (deep link qui a "fui" hors de l'interception normale de
  // openAuthSessionAsync — voir ce fichier pour le détail).
  const [error, setError] = useState(params.error ? describeGoogleSigninError(params.error) : '');
  const [formOpen, setFormOpen] = useState(false);
  const [formPreset, setFormPreset] = useState<Partial<(typeof MAILBOX_PRESETS)[string]> | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  // Créer/rejoindre une entreprise exige une identité personnelle préalable (décision
  // produit — plan "Découpler l'identité personnelle de l'accès organisation", Phase
  // 2). Contrairement au web, openAuthSessionAsync ne démonte jamais cet écran pendant
  // le flux Google — un simple état en mémoire (dans SessionContext, partagé avec
  // (auth)/_layout.tsx qui doit lui aussi ignorer "user truthy" pendant ce temps) suffit.
  const pendingIntent = isWelcomeIntent(pendingOrgIntent) ? pendingOrgIntent : null;

  useEffect(() => {
    if (!pendingIntent || !hasPersonalAccount) return;
    setFormOpen(false);
    if (pendingIntent === 'create-enterprise') {
      // Ne PAS effacer pendingOrgIntent ici : la modale reste sur cet écran, il faut
      // continuer à tenir (auth)/_layout.tsx à distance — seule sa fermeture l'efface,
      // voir onClose plus bas.
      setCreateOpen(true);
    } else {
      setPendingOrgIntent(null);
      router.push('/(auth)/activate');
    }
  }, [pendingIntent, hasPersonalAccount, setPendingOrgIntent]);

  // Si poussé par activate.tsx (suppressAutoNav) et abandonné (retour arrière sans
  // connecter d'identité perso) plutôt que résolu via router.back() ci-dessus, le
  // marqueur resterait sinon posé indéfiniment pour le reste de la session en mémoire
  // — (auth)/_layout.tsx ne redirigerait alors plus jamais vers l'inbox après un login
  // classique tant que l'app n'est pas redémarrée. Nettoyage sûr même sur le chemin
  // "résolu" : le marqueur est déjà à null à ce moment-là (no-op).
  useEffect(() => {
    return () => {
      if (suppressAutoNav) setPendingOrgIntent(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await login(data.token, data.user, data.organization);
      // Si un intent create/join-enterprise attend une identité perso, laisser l'effet
      // ci-dessus reprendre ; idem si (auth)/activate.tsx attend notre retour.
      if (!pendingIntent && !suppressAutoNav) router.replace('/(app)/(drawer)/inbox');
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
    if (id === 'create-enterprise' || id === 'join-enterprise') {
      if (!hasPersonalAccount) {
        setPendingOrgIntent(id);
        return;
      }
      if (id === 'create-enterprise') setCreateOpen(true);
      else router.push('/(auth)/activate');
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
        <Text className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          {pendingIntent ? 'Connectez d’abord votre identité personnelle — nous reprendrons ensuite.' : 'Choisissez le service de messagerie à connecter.'}
        </Text>

        <View className="-mx-6 border-t border-neutral-200 dark:border-neutral-800">
          {/* pendingOrgIntent brut (pas juste pendingIntent) : cache aussi ces entrées
              pendant le sous-flux poussé par activate.tsx, pour ne pas laisser
              l'utilisateur écraser son marqueur 'activate-awaiting-personal' en
              cliquant "Créer/Rejoindre une entreprise" ici par erreur. */}
          {ENTRIES.filter(entry => !pendingOrgIntent || (entry.id !== 'create-enterprise' && entry.id !== 'join-enterprise')).map(entry => (
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
        {pendingIntent ? (
          <Pressable onPress={() => setPendingOrgIntent(null)}>
            <Text className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">Annuler</Text>
          </Pressable>
        ) : null}

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
        onSaved={() => {
          setFormOpen(false);
          // Si un intent create/join-enterprise attend une identité perso, laisser
          // l'effet ci-dessus reprendre ; idem si (auth)/activate.tsx attend notre retour.
          if (!pendingIntent && !suppressAutoNav) router.replace('/(app)/(drawer)/inbox');
        }}
      />
      <CreateEnterpriseFlow
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setPendingOrgIntent(null);
        }}
      />
    </ScrollView>
  );
}
