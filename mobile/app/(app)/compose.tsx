import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSenders } from '../../src/hooks/useSenders';
import { sendReply } from '../../src/api/mail';
import { ApiError } from '../../src/api/client';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { SenderSelect } from '../../src/components/composer/SenderSelect';
import { NoSendersNotice } from '../../src/components/composer/NoSendersNotice';
import { AttachmentPicker } from '../../src/components/composer/AttachmentPicker';
import type { PickedAttachment } from '../../src/types/api';

export default function ComposeScreen() {
  const params = useLocalSearchParams<{
    mode?: 'new' | 'reply' | 'forward';
    threadId?: string;
    sourceMessageId?: string;
    to?: string;
    subject?: string;
  }>();
  const mode = params.mode ?? 'new';
  const { senders, loading: sendersLoading } = useSenders();
  const queryClient = useQueryClient();

  const [fromEmail, setFromEmail] = useState('');
  const [to, setTo] = useState(params.to ?? '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(() => {
    let subj = params.subject ?? '';
    if (mode === 'reply' && subj && !/^re:/i.test(subj)) subj = `Re: ${subj}`;
    if (mode === 'forward' && subj && !/^fwd:/i.test(subj)) subj = `Fwd: ${subj}`;
    return subj;
  });
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<PickedAttachment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const def = senders.find(s => s.isDefault) ?? senders[0];
    if (def) setFromEmail(def.email);
  }, [senders]);

  const canWrite = senders.length > 0;
  const title = mode === 'new' ? 'Nouveau mail' : mode === 'forward' ? 'Transférer' : `Répondre à ${to}`;

  const submit = async () => {
    if (!to.trim() || !message.trim()) return;
    setError('');
    setLoading(true);
    try {
      const result = await sendReply(
        {
          to: to.trim(),
          subject,
          message,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          mode: mode === 'forward' ? 'forward' : undefined,
          threadId: params.threadId,
          sourceMessageId: params.sourceMessageId,
          fromEmail: fromEmail || undefined,
        },
        mode === 'forward' ? [] : files
      );
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      if (result.threadId) queryClient.invalidateQueries({ queryKey: ['thread', result.threadId] });
      if (router.canGoBack()) router.back();
      if (result.threadId) router.push(`/(app)/thread/${result.threadId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Échec de l'envoi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView contentContainerClassName="gap-4 p-4">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</Text>

        {sendersLoading ? null : !canWrite ? (
          <NoSendersNotice />
        ) : (
          <>
            <SenderSelect senders={senders} value={fromEmail} onChange={setFromEmail} disabled={mode !== 'new'} />
            <Input label="À" value={to} onChangeText={setTo} editable={mode !== 'reply'} autoCapitalize="none" keyboardType="email-address" />
            {!showCcBcc ? (
              <Text onPress={() => setShowCcBcc(true)} className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                + Cc / Cci
              </Text>
            ) : (
              <>
                <Input label="Cc" value={cc} onChangeText={setCc} autoCapitalize="none" placeholder="adresse1@exemple.com, adresse2@exemple.com" />
                <Input label="Cci" value={bcc} onChangeText={setBcc} autoCapitalize="none" placeholder="adresse@exemple.com" />
              </>
            )}
            <Input label="Sujet" value={subject} onChangeText={setSubject} />
            <Input
              label="Message"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              className="min-h-32"
              placeholder="Rédigez votre message…"
            />
            {mode !== 'forward' ? (
              <AttachmentPicker files={files} onChange={setFiles} />
            ) : (
              <Text className="text-xs text-neutral-400 dark:text-neutral-500">
                Les pièces jointes du message d'origine seront automatiquement incluses.
              </Text>
            )}
            {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
            <View className="flex-row gap-3">
              <Button variant="secondary" className="flex-1" onPress={() => router.back()}>
                Fermer
              </Button>
              <Button className="flex-1" onPress={submit} loading={loading} disabled={!to.trim() || !message.trim()}>
                Envoyer
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
