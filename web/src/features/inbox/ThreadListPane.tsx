import { Inbox as InboxIcon, Trash2 } from 'lucide-react'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { ThreadListItem } from './ThreadListItem'
import type { ThreadListItem as ThreadListItemType, MailRoute } from '../../types/api'
import type { Folder } from './InboxPage'

interface ThreadListPaneProps {
  threads: ThreadListItemType[]
  loading: boolean
  error?: string
  onRetry?: () => void
  folder: Folder
  mailRoutes: MailRoute[]
  resendConnected: boolean
  searching?: boolean
}

export function ThreadListPane({ threads, loading, error, onRetry, folder, mailRoutes, resendConnected, searching }: ThreadListPaneProps) {
  if (loading) return <Spinner />

  if (error) return <ErrorState message={error} onRetry={onRetry ?? (() => {})} />

  if (threads.length === 0) {
    if (searching) {
      return <EmptyState icon={<InboxIcon size={32} />} title="Aucun résultat pour cette recherche" />
    }
    if (!resendConnected) {
      return <EmptyState icon={<InboxIcon size={32} />} title="Pas encore connecté" message="Finalisez la connexion à Resend pour commencer à recevoir des emails." />
    }
    if (folder === 'trash') {
      return <EmptyState icon={<Trash2 size={32} />} title="Corbeille vide" />
    }
    return (
      <EmptyState
        icon={<InboxIcon size={32} />}
        title={folder === 'sent' ? 'Aucun mail envoyé' : 'Aucun résultat'}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto flex-1">
      {threads.map(t => (
        <ThreadListItem key={t.id} thread={t} mailRoutes={mailRoutes} folder={folder} />
      ))}
    </div>
  )
}
