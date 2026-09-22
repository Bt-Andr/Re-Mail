import { useEffect, useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { createMailboxConnection, reconnectMailboxConnection, signinMailbox } from '../../api/mailboxConnections';
import { describeError } from '../../api/client';
import { useSession } from '../../context/SessionContext';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { ExternalMailboxConnection } from '../../types/api';

const EMPTY = { email: '', imapHost: '', imapPort: '993', imapSecure: true, smtpHost: '', smtpPort: '465', smtpSecure: true, password: '' };

// Préréglages hôte/port par fournisseur — réduit la friction de saisie pour l'écran
// "ajouter un compte" (voir ProviderPickerSheet). Pas d'OAuth pour ces fournisseurs
// (seul Google en a un, voir connectGmail dans mailboxes.tsx) : ça reste le connecteur
// IMAP générique, juste avec les champs serveur déjà remplis.
export const MAILBOX_PRESETS: Record<string, Partial<typeof EMPTY>> = {
  outlook: { imapHost: 'outlook.office365.com', imapPort: '993', smtpHost: 'smtp-mail.outlook.com', smtpPort: '587', smtpSecure: false },
  yahoo: { imapHost: 'export.imap.mail.yahoo.com', imapPort: '993', smtpHost: 'smtp.mail.yahoo.com', smtpPort: '465', smtpSecure: true },
  exchange: { imapPort: '993', smtpPort: '587', smtpSecure: false },
};

export type ManualMailboxProvider = 'outlook' | 'yahoo' | 'exchange' | 'other';

const PROVIDER_GUIDANCE: Record<ManualMailboxProvider, string> = {
  outlook: "Microsoft exige l'authentification moderne OAuth2. Cette connexion manuelle ne peut fonctionner que si votre compte ou votre administrateur autorise un mot de passe d'application ; sinon utilisez votre fournisseur officiel en attendant l'intégration OAuth Microsoft.",
  yahoo: "Créez un mot de passe d'application dans Sécurité du compte Yahoo, puis collez ce code ici. Votre mot de passe Yahoo habituel est généralement refusé par les applications tierces.",
  exchange: "Les serveurs Exchange dépendent de votre organisation. Demandez les hôtes IMAP/SMTP et la méthode d'authentification à votre administrateur ; Microsoft 365 impose généralement OAuth2.",
  other: "Utilisez les paramètres IMAP et SMTP fournis par votre hébergeur. Le serveur teste la réception puis l'envoi avant d'enregistrer la connexion.",
};

const PROVIDER_HELP: Partial<Record<ManualMailboxProvider, { label: string; url: string }>> = {
  outlook: { label: 'Voir les prérequis Microsoft', url: 'https://support.microsoft.com/en-us/outlook/pop-imap-and-smtp-settings-for-outlook-com' },
  yahoo: { label: "Créer un mot de passe d'application Yahoo", url: 'https://help.yahoo.com/kb/SLN15241.html' },
  exchange: { label: 'Voir les prérequis Microsoft', url: 'https://support.microsoft.com/en-us/outlook/pop-imap-and-smtp-settings-for-outlook-com' },
};

export function inferManualMailboxProvider(connection: Pick<ExternalMailboxConnection, 'imapHost' | 'smtpHost'>): ManualMailboxProvider {
  const hosts = `${connection.imapHost} ${connection.smtpHost}`.toLowerCase();
  if (hosts.includes('yahoo')) return 'yahoo';
  if (hosts.includes('office365') || hosts.includes('outlook')) return 'outlook';
  return 'other';
}

interface MailboxConnectionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  preset?: Partial<typeof EMPTY>;
  provider?: ManualMailboxProvider;
  connection?: ExternalMailboxConnection | null;
  // 'connect' (défaut) : ajoute une boîte à la session existante, comportement
  // inchangé. 'signin' : aucune session requise — signinMailbox() crée un compte
  // perso à la volée si l'email est inconnu et renvoie directement une session,
  // comme "Continuer avec Google".
  mode?: 'connect' | 'signin';
}

// En réparation, l'adresse reste immuable mais les serveurs et le secret peuvent être
// ressaisis ; le backend ne les remplace qu'après validation IMAP puis SMTP.
export function MailboxConnectionFormModal({ open, onClose, onSaved, preset, provider = 'other', connection, mode = 'connect' }: MailboxConnectionFormModalProps) {
  const { login } = useSession();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const activeProvider = connection ? inferManualMailboxProvider(connection) : provider;
  const providerHelp = PROVIDER_HELP[activeProvider];

  useEffect(() => {
    if (open) {
      setForm(connection
        ? {
            email: connection.email,
            imapHost: connection.imapHost,
            imapPort: String(connection.imapPort),
            imapSecure: connection.imapSecure,
            smtpHost: connection.smtpHost,
            smtpPort: String(connection.smtpPort),
            smtpSecure: connection.smtpSecure,
            password: '',
          }
        : { ...EMPTY, ...preset });
      setError('');
    }
  }, [connection, open, preset]);

  const canSubmit = form.email.trim() && form.imapHost.trim() && form.smtpHost.trim() && form.password;

  const submit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const values = {
        email: form.email.trim(),
        imapHost: form.imapHost.trim(),
        imapPort: Number(form.imapPort),
        imapSecure: form.imapSecure,
        smtpHost: form.smtpHost.trim(),
        smtpPort: Number(form.smtpPort),
        smtpSecure: form.smtpSecure,
        password: form.password,
      };
      if (mode === 'signin') {
        const data = await signinMailbox(values);
        // IMAP signin ne résout jamais qu'un compte perso (voir Phase 1) — toujours
        // login(), jamais connectOrganization(). Ne navigue pas ici : seul appelant
        // (welcome.tsx) décide, pour pouvoir reprendre un intent create/join-enterprise
        // en attente au lieu de partir vers l'inbox.
        await login(data.token, data.user, data.organization);
        onSaved();
        return;
      }
      if (connection) await reconnectMailboxConnection(connection.id, values);
      else await createMailboxConnection(values);
      onSaved();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={connection ? 'Réparer la connexion' : 'Connecter une boîte mail'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onPress={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" onPress={submit} loading={loading} disabled={!canSubmit}>
            {connection ? 'Tester et reconnecter' : 'Connecter'}
          </Button>
        </>
      }
    >
      <View className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          {PROVIDER_GUIDANCE[activeProvider]}
        </Text>
        {providerHelp ? (
          <Pressable onPress={() => void Linking.openURL(providerHelp.url)}>
            <Text className="mt-2 text-xs font-medium text-neutral-900 underline dark:text-neutral-100">{providerHelp.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <Input
        label="Adresse email"
        placeholder="vous@exemple.com"
        value={form.email}
        onChangeText={t => setForm(p => ({ ...p, email: t }))}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!connection}
      />
      <Input
        label="Serveur IMAP (réception)"
        placeholder="imap.exemple.com"
        value={form.imapHost}
        onChangeText={t => setForm(p => ({ ...p, imapHost: t }))}
        autoCapitalize="none"
      />
      <Input label="Port IMAP" value={form.imapPort} onChangeText={t => setForm(p => ({ ...p, imapPort: t }))} keyboardType="number-pad" />
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">TLS direct IMAP (port 993) — désactivez pour STARTTLS</Text>
        <Switch value={form.imapSecure} onValueChange={v => setForm(p => ({ ...p, imapSecure: v }))} />
      </View>
      <Input
        label="Serveur SMTP (envoi)"
        placeholder="smtp.exemple.com"
        value={form.smtpHost}
        onChangeText={t => setForm(p => ({ ...p, smtpHost: t }))}
        autoCapitalize="none"
      />
      <Input label="Port SMTP" value={form.smtpPort} onChangeText={t => setForm(p => ({ ...p, smtpPort: t }))} keyboardType="number-pad" />
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">TLS direct SMTP (port 465) — désactivez pour STARTTLS/587</Text>
        <Switch value={form.smtpSecure} onValueChange={v => setForm(p => ({ ...p, smtpSecure: v }))} />
      </View>
      <Input label={connection ? "Nouveau mot de passe ou mot de passe d'application" : "Mot de passe ou mot de passe d'application"} value={form.password} onChangeText={t => setForm(p => ({ ...p, password: t }))} secureTextEntry />
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </Modal>
  );
}
