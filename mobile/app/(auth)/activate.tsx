import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { resolveInviteByToken } from '../../src/api/invites';
import { describeError } from '../../src/api/client';
import { useSession } from '../../src/context/SessionContext';
import { UploadFileStep } from '../../src/components/activate/UploadFileStep';
import { VerifyCodeStep } from '../../src/components/activate/VerifyCodeStep';
import { SetPasswordStep } from '../../src/components/activate/SetPasswordStep';
import { Button } from '../../src/components/ui/Button';

// `token` arrive via un lien d'invitation par email (web aujourd'hui) ou un deep
// link natif une fois les App/Universal Links configurés (voir plan roadmap) —
// saute directement à l'étape du code, sans upload manuel du fichier.
export default function ActivateScreen() {
  const { token: linkToken } = useLocalSearchParams<{ token?: string }>();
  const { hasPersonalAccount, setPendingOrgIntent } = useSession();

  const [fileToken, setFileToken] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [resolvingLink, setResolvingLink] = useState(!!linkToken);
  const [linkError, setLinkError] = useState('');
  const [awaitingPersonal, setAwaitingPersonal] = useState(false);

  // (auth)/welcome.tsx reste empilé au-dessus tant qu'on ne revient pas ici — dès que
  // l'identité personnelle est connectée là-bas, ce même écran (jamais démonté par la
  // navigation push, voir router.back() ci-dessous) reprend automatiquement.
  useEffect(() => {
    if (awaitingPersonal && hasPersonalAccount) {
      setAwaitingPersonal(false);
      setPendingOrgIntent(null);
      router.back();
    }
  }, [awaitingPersonal, hasPersonalAccount, setPendingOrgIntent]);

  useEffect(() => {
    if (!linkToken) return;
    let cancelled = false;
    resolveInviteByToken(linkToken)
      .then(data => {
        if (cancelled) return;
        setFileToken(data.fileToken);
        setOrganizationName(data.organizationName);
      })
      .catch(e => {
        if (!cancelled) setLinkError(describeError(e));
      })
      .finally(() => {
        if (!cancelled) setResolvingLink(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkToken]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-neutral-50 dark:bg-neutral-950"
    >
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-sm gap-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <View className="mb-2 flex-row items-center gap-2.5">
            <Image source={require('../../assets/icon.png')} className="h-7 w-7 rounded-md" />
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Activer mon compte</Text>
          </View>

          {resolvingLink && <ActivityIndicator />}

          {!resolvingLink && linkError ? <Text className="text-xs text-red-600">{linkError}</Text> : null}

          {!resolvingLink && !fileToken && (
            <UploadFileStep
              onResolved={(token, orgName) => {
                setFileToken(token);
                setOrganizationName(orgName);
              }}
            />
          )}

          {fileToken && !activationToken && (
            <VerifyCodeStep fileToken={fileToken} organizationName={organizationName} onVerified={setActivationToken} />
          )}

          {fileToken && activationToken && !hasPersonalAccount && (
            <View className="gap-3">
              <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                3. Connectez d'abord votre identité personnelle
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                Rejoindre une entreprise sur Re-Mail nécessite d'abord une identité personnelle (Google ou une autre
                boîte mail) — l'accès à l'organisation vient s'ajouter à celle-ci, il ne la remplace jamais.
              </Text>
              <Button
                onPress={() => {
                  setAwaitingPersonal(true);
                  // Marqueur distinct de ceux que welcome.tsx gère lui-même
                  // ('create-enterprise'/'join-enterprise') — juste pour tenir
                  // (auth)/_layout.tsx à distance le temps de notre propre retour.
                  setPendingOrgIntent('activate-awaiting-personal');
                  router.push({ pathname: '/(auth)/welcome', params: { suppressAutoNav: '1' } });
                }}
              >
                Connecter mon identité personnelle
              </Button>
            </View>
          )}

          {fileToken && activationToken && hasPersonalAccount && (
            <SetPasswordStep fileToken={fileToken} activationToken={activationToken} />
          )}

          <Link href="/(auth)/login" asChild>
            <Text className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Déjà activé ? <Text className="font-medium text-neutral-900 dark:text-neutral-100">Se connecter</Text>
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
