import { MailOpen } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'

export function InboxPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center bg-card rounded-lg border border-border min-w-0">
      <EmptyState icon={<MailOpen size={32} />} title="Sélectionnez une conversation" message="Choisissez un message dans la liste pour l'afficher ici." />
    </div>
  )
}
