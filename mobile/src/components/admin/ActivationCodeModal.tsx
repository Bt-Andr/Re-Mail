import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AlertTriangle, Copy } from 'lucide-react-native';
import { generateActivationCode } from '../../api/invites.admin';
import { describeError } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { UserInvite } from '../../types/api';

export function ActivationCodeModal({ invite, onClose }: { invite: UserInvite | null; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!invite) {
      setCode(null);
      setError('');
      return;
    }
    setLoading(true);
    generateActivationCode(invite.id)
      .then(data => {
        setCode(data.code);
        setExpiresAt(data.expiresAt);
      })
      .catch(e => setError(describeError(e)))
      .finally(() => setLoading(false));
  }, [invite]);

  if (!invite) return null;

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal open title={`Code d'activation — ${invite.username}`} onClose={onClose} footer={<Button className="flex-1" onPress={onClose}>Fermer</Button>}>
      {loading && <ActivityIndicator />}
      {!loading && error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      {!loading && code && (
        <>
          <View className="flex-row items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <AlertTriangle size={16} color="#d97706" />
            <Text className="flex-1 text-xs text-amber-800 dark:text-amber-300">
              Ce code ne sera plus jamais affiché. Communiquez-le à {invite.nom} par un canal séparé du fichier
              d'activation (ex. téléphone), pas dans le même message.
            </Text>
          </View>
          <Pressable
            onPress={copy}
            className="flex-row items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <Text className="font-mono text-lg tracking-widest text-neutral-900 dark:text-neutral-100">{code}</Text>
            <Copy size={16} color="#9ca3af" />
          </Pressable>
          {copied && <Text className="text-xs text-emerald-600">Copié.</Text>}
          {expiresAt && (
            <Text className="text-xs text-neutral-400 dark:text-neutral-500">
              Expire {new Date(expiresAt).toLocaleTimeString('fr-FR')}
            </Text>
          )}
        </>
      )}
    </Modal>
  );
}
