import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Check, CheckCircle2, Copy } from 'lucide-react-native';
import { getOrgSummary, connectResend, selectResendDomain, setResendWebhookSecret } from '../../api/organizations';
import { describeError } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { OrgSummary } from '../../types/api';

type Step = 'connect' | 'domain' | 'webhook' | 'done';

function stepFor(org: OrgSummary): Step {
  if (!org.resendConnected) return 'connect';
  if (!org.resendVerifiedDomain) return 'domain';
  if (!org.webhookConfigured) return 'webhook';
  return 'done';
}

// Équivalent mobile de web/features/mailboxes/ResendConnectModal.tsx, mais construit
// depuis zéro : pas de ConnectResendStep/SelectDomainStep/WebhookSecretStep côté mobile
// à réutiliser, l'onboarding est resté web-only jusqu'ici. Même logique de progression
// par étape dérivée de GET /organizations/me, même arrêt après le webhook — pas d'étape
// expéditeur/routage ici, configurable ensuite dans Réglages.
export function ResendConnectSheet({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [verifiedDomains, setVerifiedDomains] = useState<string[] | null>(null);

  const [apiKey, setApiKey] = useState('');
  const [domain, setDomain] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refetchOrg = () => {
    setLoadingOrg(true);
    getOrgSummary()
      .then(setOrg)
      .catch(e => setError(describeError(e)))
      .finally(() => setLoadingOrg(false));
  };

  useEffect(() => {
    if (open) refetchOrg();
  }, [open]);

  const step: Step = org ? stepFor(org) : 'connect';

  const submitConnect = async () => {
    if (!apiKey.trim()) return;
    setError('');
    setLoading(true);
    try {
      const data = await connectResend(apiKey.trim());
      setVerifiedDomains(data.verifiedDomains);
      setDomain(data.verifiedDomains[0] ?? '');
      refetchOrg();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  const submitDomain = async () => {
    if (!domain.trim()) return;
    setError('');
    setLoading(true);
    try {
      await selectResendDomain(domain.trim());
      refetchOrg();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  const submitWebhook = async () => {
    if (!webhookSecret.trim()) return;
    setError('');
    setLoading(true);
    try {
      await setResendWebhookSecret(webhookSecret.trim());
      refetchOrg();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookUrl = async () => {
    if (!org?.webhookUrl) return;
    await Clipboard.setStringAsync(org.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const close = () => {
    setApiKey('');
    setDomain('');
    setWebhookSecret('');
    setVerifiedDomains(null);
    setError('');
    onClose();
  };

  return (
    <Modal open={open} title="Connecter Resend" onClose={close}>
      {loadingOrg || !org ? (
        <ActivityIndicator />
      ) : step === 'connect' ? (
        <>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Collez la clé API de votre compte Resend (resend.com/api-keys). Elle est chiffrée avant stockage.
          </Text>
          <Input label="Clé API Resend" placeholder="re_xxxxxxxxxxxx" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" />
          {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
          <Button onPress={submitConnect} loading={loading} disabled={!apiKey.trim()}>
            Connecter
          </Button>
        </>
      ) : step === 'domain' ? (
        <>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Le domaine déjà vérifié dans votre compte Resend, utilisé pour envoyer/recevoir vos emails.
          </Text>
          <View className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <Text className="text-xs text-amber-800 dark:text-amber-300">
              Si ce domaine a déjà des emails ailleurs (Gmail, Outlook, un autre hébergeur...), la réception Resend
              entrera en conflit avec les enregistrements MX existants. Utilisez plutôt un sous-domaine dédié (ex.
              mail.votredomaine.com).
            </Text>
          </View>
          {verifiedDomains && verifiedDomains.length === 0 && (
            <View className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <Text className="text-xs text-amber-800 dark:text-amber-300">
                Aucun domaine vérifié trouvé dans votre compte Resend. Vérifiez-en un dans votre dashboard Resend,
                puis revenez ici.
              </Text>
            </View>
          )}
          {verifiedDomains && verifiedDomains.length > 1 && (
            <View className="flex-row flex-wrap gap-2">
              {verifiedDomains.map(d => (
                <Pressable
                  key={d}
                  onPress={() => setDomain(d)}
                  className={`rounded-full border px-3 py-1.5 ${
                    domain === d ? 'border-neutral-900 bg-neutral-900 dark:border-white dark:bg-white' : 'border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <Text className={`text-xs ${domain === d ? 'text-white dark:text-neutral-900' : 'text-neutral-700 dark:text-neutral-300'}`}>{d}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Input label="Nom de domaine" placeholder="mail.votredomaine.com" value={domain} onChangeText={setDomain} autoCapitalize="none" />
          {verifiedDomains === null && (
            <Text className="text-xs text-neutral-400 dark:text-neutral-500">
              Fenêtre rouverte : saisissez à nouveau le domaine déjà vérifié dans Resend.
            </Text>
          )}
          {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
          <Button onPress={submitDomain} loading={loading} disabled={!domain.trim()}>
            Continuer
          </Button>
        </>
      ) : step === 'webhook' ? (
        <>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            Dans votre dashboard Resend → Webhooks → Add Webhook, collez l'URL ci-dessous et cochez l'événement
            "email.received". Resend affiche ensuite un secret de signature à coller ici.
          </Text>
          <Pressable
            onPress={copyWebhookUrl}
            className="flex-row items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <Text className="flex-1 text-xs text-neutral-700 dark:text-neutral-300" numberOfLines={1}>
              {org.webhookUrl}
            </Text>
            {copied ? <Check size={16} color="#16a34a" /> : <Copy size={16} color="#9ca3af" />}
          </Pressable>
          <Input
            label="Secret de signature Resend"
            placeholder="whsec_..."
            value={webhookSecret}
            onChangeText={setWebhookSecret}
            autoCapitalize="none"
          />
          {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
          <Button onPress={submitWebhook} loading={loading} disabled={!webhookSecret.trim()}>
            Valider
          </Button>
        </>
      ) : (
        <View className="items-center gap-3 py-6">
          <CheckCircle2 size={40} color="#059669" />
          <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Resend connecté.</Text>
          <Button
            onPress={() => {
              close();
              onConnected();
            }}
          >
            Terminer
          </Button>
        </View>
      )}
    </Modal>
  );
}
