import { Mail, ChevronRight } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { GoogleIcon, OutlookIcon, YahooIcon, ExchangeIcon } from '../../components/icons/ProviderIcons'

export type MailboxProvider = 'google' | 'outlook' | 'yahoo' | 'exchange' | 'other'

const PROVIDERS: { id: MailboxProvider; label: string; icon: JSX.Element }[] = [
  { id: 'google', label: 'Google', icon: <GoogleIcon /> },
  { id: 'outlook', label: 'Outlook, Hotmail et Live', icon: <OutlookIcon /> },
  { id: 'yahoo', label: 'Yahoo', icon: <YahooIcon /> },
  { id: 'exchange', label: 'Exchange et Office 365', icon: <ExchangeIcon /> },
  { id: 'other', label: 'Autre', icon: <Mail size={20} className="text-muted-foreground" /> },
]

// Seul "Google" passe par OAuth (connectGmail) — les 4 autres ouvrent le connecteur
// IMAP générique déjà existant, avec des préréglages hôte/port par fournisseur (voir
// MAILBOX_PRESETS dans MailboxConnectionFormModal) plutôt qu'un formulaire vide.
export function ProviderPickerModal({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (provider: MailboxProvider) => void }) {
  return (
    <Modal open={open} title="Configurez votre adresse e-mail" onClose={onClose}>
      <div className="-mx-6 -mb-6 divide-y divide-border border-t border-border">
        {PROVIDERS.map(provider => (
          <button
            key={provider.id}
            type="button"
            onClick={() => onSelect(provider.id)}
            className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-accent transition-colors"
          >
            <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">{provider.icon}</span>
            <span className="flex-1 text-sm text-foreground">{provider.label}</span>
            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </Modal>
  )
}
