import { NavLink } from 'react-router-dom'
import { Badge, statusBadgeColor } from '../../components/ui/Badge'
import { relativeTime, stripHtml, canalDisplayName } from '../../lib/format'
import type { ThreadListItem as ThreadListItemType, MailRoute } from '../../types/api'
import type { Folder } from './InboxPage'

const STATUS_LABEL: Record<string, string> = { nouveau: 'Nouveau', en_cours: 'En cours', resolu: 'Résolu' }

export function ThreadListItem({ thread, mailRoutes, folder }: { thread: ThreadListItemType; mailRoutes: MailRoute[]; folder: Folder }) {
  const hasUnread = thread.unreadCount > 0
  const label = canalDisplayName(thread.canal, mailRoutes)

  return (
    <NavLink
      to={`/${folder}/${thread.id}`}
      className={({ isActive }) =>
        `block bg-card rounded-lg border p-3 transition-all ${isActive ? 'border-ring ring-1 ring-ring/30' : 'border-border hover:border-foreground/20'} ${hasUnread ? 'shadow-sm' : ''}`
      }
    >
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Badge>{label ?? thread.canal}</Badge>
        <Badge color={statusBadgeColor(thread.status)}>{STATUS_LABEL[thread.status] ?? thread.status}</Badge>
        {hasUnread && <span className="ml-auto px-1.5 py-0.5 bg-primary text-primary-foreground text-xs rounded-full font-bold">{thread.unreadCount}</span>}
      </div>
      <p className={`text-sm truncate ${hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'}`}>{thread.sujet}</p>
      <p className="text-xs text-muted-foreground truncate">{thread.externalFrom} · {thread.toEmail ?? thread.externalEmail}</p>
      {thread.lastMessage && (
        <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
          {thread.lastMessage.direction === 'outbound' ? '↑ ' : '↓ '}
          {stripHtml(thread.lastMessage.body).slice(0, 60)}
        </p>
      )}
      <p className="text-xs text-muted-foreground/80 mt-1">{relativeTime(thread.updatedAt)}</p>
    </NavLink>
  )
}
