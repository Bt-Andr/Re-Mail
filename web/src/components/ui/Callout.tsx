import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

// Encart d'avertissement — même traitement visuel ambre répété (à la main, légèrement
// différent à chaque fois) dans ActivationCodeModal, et côté webmail dans
// NoSendersNotice/SelectDomainStep. Normalisé ici en un seul composant plutôt que trois
// variantes de padding/icône quasi identiques.
export function Callout({ children, icon = true }: { children: ReactNode; icon?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
      {icon && <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={16} />}
      <div>{children}</div>
    </div>
  )
}
