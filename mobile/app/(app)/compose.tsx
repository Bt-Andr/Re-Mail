import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Trash2 } from 'lucide-react-native';
import { useSenders } from '../../src/hooks/useSenders';
import { useAccountSwitcher } from '../../src/context/AccountSwitcherContext';
import { sendReply } from '../../src/api/mail';
import { createDraft, deleteDraft, updateDraft } from '../../src/api/drafts';
import { describeError } from '../../src/api/client';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { SenderSelect } from '../../src/components/composer/SenderSelect';
import { NoSendersNotice } from '../../src/components/composer/NoSendersNotice';
import { AttachmentPicker } from '../../src/components/composer/AttachmentPicker';
import { TemplatePickerModal } from '../../src/components/composer/TemplatePickerModal';
import { ContactAutocomplete } from '../../src/components/composer/ContactAutocomplete';
import type { PickedAttachment, ReplyTemplate } from '../../src/types/api';

const DRAFT_AUTOSAVE_DELAY_MS = 1200;

export default function ComposeScreen() {
  const params = useLocalSearchParams<{
    mode?: 'new' | 'reply' | 'forward';
    threadId?: string;
    sourceMessageId?: string;
    to?: string;
    subject?: string;
    canal?: string;
    draftId?: string;
    ccEmail?: string;
    bccEmail?: string;
    body?: string;
  }>();
  const mode = params.mode ?? 'new';
  const { senders, loading: sendersLoading } = useSenders();
  const { accounts, selectedAccountId } = useAccountSwitcher();
  const queryClient = useQueryClient();

  const [fromEmail, setFromEmail] = useState('');
  const [to, setTo] = useState(params.to ?? '');
  const [cc, setCc] = useState(params.ccEmail ?? '');
  const [bcc, setBcc] = useState(params.bccEmail ?? '');
  const [showCcBcc, setShowCcBcc] = useState(!!(params.ccEmail || params.bccEmail));
  const [subject, setSubject] = useState(() => {
    let subj = params.subject ?? '';
    if (mode === 'reply' && subj && !/^re:/i.test(subj)) subj = `Re: ${subj}`;
    if (mode === 'forward' && subj && !/^fwd:/i.test(subj)) subj = `Fwd: ${subj}`;
    return subj;
  });
  const [message, setMessage] = useState(params.body ?? '');
  const [files, setFiles] = useState<PickedAttachment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const draftIdRef = useRef<string | undefined>(params.draftId);
  const [hasSavedDraft, setHasSavedDraft] = useState(!!params.draftId);
  const skipNextAutosaveRef = useRef(!!params.draftId);

  const invalidateDrafts = () => queryClient.invalidateQueries({ queryKey: ['drafts'] });

  // Enregistre un brouillon en base après une pause de saisie — permet de reprendre
  // la rédaction plus tard (app fermée, changement d'écran) sans perdre le texte.
  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    const hasContent = to.trim() || cc.trim() || bcc.trim() || subject.trim() || message.trim();
    if (!hasContent) return;
    const timer = setTimeout(() => {
      const values = { toEmail: to, ccEmail: cc, bccEmail: bcc, subject, body: message };
      const save = draftIdRef.current ? updateDraft(draftIdRef.current, values) : createDraft(values);
      save
        .then(draft => {
          draftIdRef.current = draft.id;
          setHasSavedDraft(true);
          invalidateDrafts();
        })
        .catch(() => {});
    }, DRAFT_AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, cc, bcc, subject, message]);

  const discardDraft = () => {
    if (draftIdRef.current) {
      deleteDraft(draftIdRef.current).catch(() => {});
      invalidateDrafts();
    }
    if (router.canGoBack()) router.back();
  };

  const applyTemplate = (template: ReplyTemplate) => {
    setMessage(prev => (prev.trim() ? `${prev}\n\n${template.corps}` : template.corps));
    setTemplatePickerOpen(false);
  };

  // Le compte actif dans le switcher devient l'expéditeur par défaut d'un nouveau
  // message — n'a d'effet que si cette adresse fait bien partie des senders autorisés ;
  // sinon repli sur l'isDefault habituel. Pour une réponse/transfert, SenderSelect est
  // désactivé (voir plus bas), le "De" réel suit le fil d'origine.
  useEffect(() => {
    const preferredEmail = selectedAccountId && selectedAccountId !== 'resend' ? accounts.find(a => a.id === selectedAccountId)?.email : undefined;
    const def = senders.find(s => s.email === preferredEmail) ?? senders.find(s => s.isDefault) ?? senders[0];
    if (def) setFromEmail(def.email);
  }, [senders, accounts, selectedAccountId]);

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
          draftId: draftIdRef.current,
        },
        mode === 'forward' ? [] : files
      );
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      if (draftIdRef.current) invalidateDrafts();
      if (result.threadId) queryClient.invalidateQueries({ queryKey: ['thread', result.threadId] });
      if (router.canGoBack()) router.back();
      if (result.threadId) router.push(`/(app)/thread/${result.threadId}`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView contentContainerClassName="gap-4 p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</Text>
          {hasSavedDraft && (
            <Pressable onPress={discardDraft} hitSlop={8} className="flex-row items-center gap-1">
              <Trash2 size={13} color="#9ca3af" />
              <Text className="text-xs text-neutral-400 dark:text-neutral-500">Supprimer le brouillon</Text>
            </Pressable>
          )}
        </View>

        {sendersLoading ? null : !canWrite ? (
          <NoSendersNotice />
        ) : (
          <>
            <SenderSelect senders={senders} value={fromEmail} onChange={setFromEmail} disabled={mode !== 'new'} />
            <ContactAutocomplete label="À" value={to} onChangeText={setTo} editable={mode !== 'reply'} autoCapitalize="none" keyboardType="email-address" />
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
            <Pressable onPress={() => setTemplatePickerOpen(true)} className="flex-row items-center gap-1 self-end">
              <FileText size={13} color="#6b7280" />
              <Text className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Insérer un modèle</Text>
            </Pressable>
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
      <TemplatePickerModal
        open={templatePickerOpen}
        canal={params.canal}
        onClose={() => setTemplatePickerOpen(false)}
        onPick={applyTemplate}
      />
    </KeyboardAvoidingView>
  );
}
