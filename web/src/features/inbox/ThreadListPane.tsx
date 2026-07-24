import { Inbox as InboxIcon } from 'lucide-react'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ThreadListItem } from './ThreadListItem'
import type { ThreadListItem as ThreadListItemType, MailRoute } from '../../types/api'
import type { Folder } from './FolderTabs'

interface ThreadListPaneProps {
  threads: ThreadListItemType[]
  loading: boolean
  folder: Folder
  mailRoutes: MailRoute[]
  resendConnected: boolean
}

export function ThreadListPane({ threads, loading, folder, mailRoutes, resendConnected }: ThreadListPaneProps) {
  if (loading) return <Spinner />

  if (threads.length === 0) {
    if (!resendConnected) {
      return <EmptyState icon={<InboxIcon size={32} />} title="Pas encore connecté" message="Finalisez la connexion à Resend pour commencer à recevoir des emails." />
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
        <ThreadListItem key={t.id} thread={t} mailRoutes={mailRoutes} />
      ))}
    </div>
  )
}
