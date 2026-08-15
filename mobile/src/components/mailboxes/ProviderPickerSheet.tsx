import { Pressable, Text } from 'react-native';
import { Mail, ChevronRight } from 'lucide-react-native';
import { Modal } from '../ui/Modal';
import { GoogleIcon, OutlookIcon, YahooIcon, ExchangeIcon, ResendIcon } from '../icons/ProviderIcons';

export type MailboxProvider = 'google' | 'outlook' | 'yahoo' | 'exchange' | 'resend' | 'other';

const PROVIDERS: { id: MailboxProvider; label: string; icon: React.ReactElement }[] = [
  { id: 'google', label: 'Google', icon: <GoogleIcon /> },
  { id: 'outlook', label: 'Outlook, Hotmail et Live', icon: <OutlookIcon /> },
  { id: 'yahoo', label: 'Yahoo', icon: <YahooIcon /> },
  { id: 'exchange', label: 'Exchange et Office 365', icon: <ExchangeIcon /> },
  { id: 'resend', label: 'Domaine professionnel (Resend)', icon: <ResendIcon /> },
  { id: 'other', label: 'Autre', icon: <Mail size={20} color="#9ca3af" /> },
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
