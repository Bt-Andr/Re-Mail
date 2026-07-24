import { useCallback, useEffect, useState } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import { Forward, Reply } from 'lucide-react'
import { apiFetch } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { MessageList } from './MessageList'
import { AssignDropdown } from './AssignDropdown'
import { StatusDropdown } from './StatusDropdown'
import type { ThreadDetail } from '../../types/api'
import type { InboxOutletContext } from './InboxPage'

function isManager(role?: string) {
  return role === 'OWNER' || role === 'ADMIN'
}

export function ThreadDetailPane() {
  const { threadId } = useParams<{ threadId: string }>()
  const { user } = useSession()
  const { openComposer, onThreadChanged } = useOutletContext<InboxOutletContext>()
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!threadId) return
    setLoading(true)
    try {
      const res = await apiFetch(`/threads/${threadId}`)
      if (res.ok) {
        setThread(await res.json())
        onThreadChanged()
      }
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  useEffect(() => {
    void load()
  }, [load])

  const assign = async (assignedToId: string | null) => {
    if (!thread) return
    const res = await apiFetch(`/threads/${thread.id}/assign`, { method: 'PATCH', body: JSON.stringify({ assignedToId }) })
    if (res.ok) {
      const updated = await res.json()
      setThread(prev => (prev ? { ...prev, ...updated } : prev))
    }
    onThreadChanged()
  }

  const changeStatus = async (status: string) => {
    if (!thread) return
    const res = await apiFetch(`/threads/${thread.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    if (res.ok) setThread(prev => (prev ? { ...prev, status: status as ThreadDetail['status'] } : prev))
    onThreadChanged()
  }

  if (loading || !thread) return <Spinner />

  const lastInbound = [...thread.messages].reverse().find(m => m.direction === 'inbound')

  return (
    <div className="flex-1 flex flex-col bg-card rounded-lg border border-border overflow-hidden min-w-0 h-full">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-snug">{thread.sujet}</p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
              <span><span className="font-medium">De :</span> {thread.externalFrom} &lt;{thread.externalEmail}&gt;</span>
              {thread.toEmail && <span><span className="font-medium">À :</span> {thread.toEmail}</span>}
            </div>
          </div>
          <StatusDropdown status={thread.status} onChange={changeStatus} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground/80 flex-shrink-0">Assigné à :</span>
          {isManager(user?.orgRole) ? (
            <AssignDropdown assignedToId={thread.assignedToId} onAssign={assign} />
          ) : (
            <span className="text-xs font-medium text-foreground/90">{thread.assignedTo?.nom ?? <span className="text-muted-foreground italic">Non assigné</span>}</span>
          )}
        </div>
      </div>

      <MessageList messages={thread.messages} />

      <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => openComposer({ mode: 'reply', threadId: thread.id, to: thread.externalEmail, subject: thread.sujet })}
        >
          <Reply size={14} />
          Répondre
        </Button>
        {lastInbound && (
          <Button
            variant="secondary"
            onClick={() => openComposer({ mode: 'forward', threadId: thread.id, sourceMessageId: lastInbound.id, subject: thread.sujet })}
          >
            <Forward size={14} />
            Transférer
          </Button>
        )}
      </div>
    </div>
  )
}
