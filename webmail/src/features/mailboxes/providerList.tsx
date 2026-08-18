import { Mail } from 'lucide-react'
import { GoogleIcon, OutlookIcon, YahooIcon, ExchangeIcon } from '../../components/icons/ProviderIcons'

// Fournisseurs génériques communs aux deux contextes qui affichent un picker :
// ProviderPickerModal ("ajouter un compte", déjà connecté — garde sa propre entrée
// 'resend' unique, sans ambiguïté puisque connecter Resend en étant déjà connecté ne
// peut désigner que le Resend de SON organisation) et WelcomePage (écran d'accueil non
// connecté, où "Entreprise" se scinde en créer/rejoindre — voir WelcomePage.tsx).
export type BaseMailboxProvider = 'google' | 'outlook' | 'yahoo' | 'exchange' | 'other'

export const BASE_PROVIDERS: { id: BaseMailboxProvider; label: string; icon: JSX.Element }[] = [
  { id: 'google', label: 'Google', icon: <GoogleIcon /> },
  { id: 'outlook', label: 'Outlook, Hotmail et Live', icon: <OutlookIcon /> },
  { id: 'yahoo', label: 'Yahoo', icon: <YahooIcon /> },
  { id: 'exchange', label: 'Exchange et Office 365', icon: <ExchangeIcon /> },
  { id: 'other', label: 'Autre', icon: <Mail size={20} className="text-muted-foreground" /> },
]
