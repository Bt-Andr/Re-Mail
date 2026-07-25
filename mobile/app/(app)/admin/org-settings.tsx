import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { CheckCircle2, Copy, XCircle } from 'lucide-react-native';
import { getOrgSummary } from '../../../src/api/organizations';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2 py-2.5">
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">{label}</Text>
      <Text className="max-w-[60%] text-right text-sm text-neutral-900 dark:text-neutral-100">{value}</Text>
    </View>
  );
}

export default function OrgSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { data: org, isLoading } = useQuery({ queryKey: ['org-summary'], queryFn: getOrgSummary });
  const [copied, setCopied] = useState(false);

  if (isLoading || !org) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <ActivityIndicator />
      </View>
    );
  }

  const copyWebhook = async () => {
    await Clipboard.setStringAsync(org.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={{ paddingBottom: insets.bottom }} className="flex-1 gap-4 bg-neutral-50 p-4 dark:bg-neutral-950">
      <View className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white px-4 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
        <Row label="Organisation" value={org.companyName || org.name} />
        <Row label="Contact" value={org.emailContact || '—'} />
      </View>

      <View className="gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <View className="flex-row items-center gap-2">
          {org.resendConnected ? <CheckCircle2 size={16} color="#10b981" /> : <XCircle size={16} color="#ef4444" />}
          <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {org.resendConnected ? 'Resend connecté' : 'Resend non connecté'}
          </Text>
        </View>
        {org.resendApiKeyLast4 && (
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Clé se terminant par •••{org.resendApiKeyLast4}</Text>
        )}
        {org.resendVerifiedDomain && (
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Domaine vérifié : {org.resendVerifiedDomain}</Text>
        )}
        <Text className="text-xs text-neutral-400 dark:text-neutral-500">{org.mailRoutesCount} adresse(s) configurée(s)</Text>
      </View>

      <View className="gap-2 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">URL de webhook Resend</Text>
        <Pressable
          onPress={copyWebhook}
          className="flex-row items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-800"
        >
          <Text numberOfLines={1} className="flex-1 font-mono text-xs text-neutral-700 dark:text-neutral-300">
            {org.webhookUrl}
          </Text>
          <Copy size={14} color="#9ca3af" />
        </Pressable>
        {copied && <Text className="text-xs text-emerald-600">Copié.</Text>}
      </View>

      <Text className="text-xs text-neutral-400 dark:text-neutral-500">
        La connexion Resend, la vérification de domaine et l'export de configuration se gèrent depuis le dashboard web.
      </Text>
    </View>
  );
}
