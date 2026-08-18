import { Mail } from 'lucide-react-native';
import { GoogleIcon, OutlookIcon, YahooIcon, ExchangeIcon } from '../icons/ProviderIcons';

// Fournisseurs génériques communs aux deux contextes qui affichent un picker :
// ProviderPickerSheet ("ajouter un compte", déjà connecté — garde sa propre entrée
// 'resend' unique) et l'écran d'accueil (auth)/welcome.tsx (non connecté, où
// "Entreprise" se scinde en créer/rejoindre).
export type BaseMailboxProvider = 'google' | 'outlook' | 'yahoo' | 'exchange' | 'other';

export const BASE_PROVIDERS: { id: BaseMailboxProvider; label: string; icon: React.ReactElement }[] = [
  { id: 'google', label: 'Google', icon: <GoogleIcon /> },
  { id: 'outlook', label: 'Outlook, Hotmail et Live', icon: <OutlookIcon /> },
  { id: 'yahoo', label: 'Yahoo', icon: <YahooIcon /> },
  { id: 'exchange', label: 'Exchange et Office 365', icon: <ExchangeIcon /> },
  { id: 'other', label: 'Autre', icon: <Mail size={20} color="#9ca3af" /> },
];
