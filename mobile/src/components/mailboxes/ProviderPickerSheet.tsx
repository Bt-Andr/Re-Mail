import { Pressable, Text } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Modal } from '../ui/Modal';
import { ResendIcon } from '../icons/ProviderIcons';
import { BASE_PROVIDERS, type BaseMailboxProvider } from './providerList';

export type MailboxProvider = BaseMailboxProvider | 'resend';

// Insère "resend" avant "other" — garde l'ordre visuel historique (autre en dernier).
const PROVIDERS: { id: MailboxProvider; label: string; icon: React.ReactElement }[] = [
  ...BASE_PROVIDERS.filter(p => p.id !== 'other'),
  { id: 'resend', label: 'Domaine professionnel (Resend)', icon: <ResendIcon /> },
  ...BASE_PROVIDERS.filter(p => p.id === 'other'),
];

// "Google" passe par OAuth (connectGmail), "Resend" ouvre ResendConnectSheet (domaine
// vérifié, pas une boîte mail existante) — les 3 autres ouvrent le connecteur IMAP
// générique déjà existant, avec des préréglages hôte/port par fournisseur (voir
// MAILBOX_PRESETS dans MailboxConnectionFormModal) plutôt qu'un formulaire vide.
export function ProviderPickerSheet({
  open,
  onClose,
  onSelect,
  showResend = true,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (provider: MailboxProvider) => void;
  // Resend est une ressource d'équipe (clé API/domaine PARTAGÉS par l'org), contrairement
  // au reste du picker (identifiants personnels) — POST /organizations/me/resend/connect
  // exige OWNER/ADMIN côté backend (requireOrgRole). Masqué ici pour un MEMBER plutôt que
  // de le laisser cliquer dessus pour finir sur un 403 "Accès non autorisé pour ce rôle".
  showResend?: boolean;
}) {
  const providers = showResend ? PROVIDERS : PROVIDERS.filter(p => p.id !== 'resend');
  return (
    <Modal open={open} title="Configurez votre adresse e-mail" onClose={onClose}>
      <>
        {providers.map(provider => (
          <Pressable key={provider.id} onPress={() => onSelect(provider.id)} className="flex-row items-center gap-3 py-1">
            {provider.icon}
            <Text className="flex-1 text-sm text-neutral-900 dark:text-neutral-100">{provider.label}</Text>
            <ChevronRight size={16} color="#9ca3af" />
          </Pressable>
        ))}
      </>
    </Modal>
  );
}
