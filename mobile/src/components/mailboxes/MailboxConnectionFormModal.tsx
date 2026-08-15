import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { createMailboxConnection } from '../../api/mailboxConnections';
import { describeError } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

const EMPTY = { email: '', imapHost: '', imapPort: '993', imapSecure: true, smtpHost: '', smtpPort: '465', smtpSecure: true, password: '' };

// Préréglages hôte/port par fournisseur — réduit la friction de saisie pour l'écran
// "ajouter un compte" (voir ProviderPickerSheet). Pas d'OAuth pour ces fournisseurs
// (seul Google en a un, voir connectGmail dans mailboxes.tsx) : ça reste le connecteur
// IMAP générique, juste avec les champs serveur déjà remplis.
export const MAILBOX_PRESETS: Record<string, Partial<typeof EMPTY>> = {
  outlook: { imapHost: 'outlook.office365.com', imapPort: '993', smtpHost: 'smtp.office365.com', smtpPort: '587' },
  yahoo: { imapHost: 'imap.mail.yahoo.com', imapPort: '993', smtpHost: 'smtp.mail.yahoo.com', smtpPort: '465' },
  exchange: { imapHost: 'outlook.office365.com', imapPort: '993', smtpHost: 'smtp.office365.com', smtpPort: '587' },
};

interface MailboxConnectionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  preset?: Partial<typeof EMPTY>;
}

// Pas d'edit ici (contrairement à MailRouteFormModal) : changer les identifiants d'une
// boîte externe, c'est en reconnecter une — plus simple de supprimer et recréer.
export function MailboxConnectionFormModal({ open, onClose, onSaved, preset }: MailboxConnectionFormModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, ...preset });
      setError('');
    }
  }, [open, preset]);

  const canSubmit = form.email.trim() && form.imapHost.trim() && form.smtpHost.trim() && form.password;

  const submit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await createMailboxConnection({
        email: form.email.trim(),
        imapHost: form.imapHost.trim(),
        imapPort: Number(form.imapPort),
        imapSecure: form.imapSecure,
        smtpHost: form.smtpHost.trim(),
        smtpPort: Number(form.smtpPort),
        smtpSecure: form.smtpSecure,
        password: form.password,
      });
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
      title="Connecter une boîte mail"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onPress={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" onPress={submit} loading={loading} disabled={!canSubmit}>
            Connecter
          </Button>
        </>
      }
    >
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
        Fonctionne avec Gmail, Outlook et la plupart des fournisseurs (identifiants IMAP/SMTP classiques). Pour
        Gmail, utilisez un mot de passe d'application plutôt que votre mot de passe habituel.
      </Text>
      <Input
        label="Adresse email"
        placeholder="vous@exemple.com"
        value={form.email}
        onChangeText={t => setForm(p => ({ ...p, email: t }))}
        autoCapitalize="none"
        keyboardType="email-address"
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
        <Text className="text-sm text-neutral-700 dark:text-neutral-300">Connexion IMAP sécurisée (TLS)</Text>
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
        <Text className="text-sm text-neutral-700 dark:text-neutral-300">Connexion SMTP sécurisée (TLS)</Text>
        <Switch value={form.smtpSecure} onValueChange={v => setForm(p => ({ ...p, smtpSecure: v }))} />
      </View>
      <Input label="Mot de passe" value={form.password} onChangeText={t => setForm(p => ({ ...p, password: t }))} secureTextEntry />
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </Modal>
  );
}
