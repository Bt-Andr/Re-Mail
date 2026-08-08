import { useCallback, useEffect, useState } from 'react'
import { useParams, useOutletContext, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Forward, Reply, Trash2, Undo2 } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { useToast } from '../../context/ToastContext'
import { Spinner } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/ErrorState'
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
  const navigate = useNavigate()
  const { user } = useSession()
  const { showToast } = useToast()
  const { openComposer, onThreadChanged, folder } = useOutletContext<InboxOutletContext>()
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    if (!threadId) return
    setLoading(true)
    setLoadError('')
    try {
      const res = await apiFetch(`/threads/${threadId}`)
      if (res.ok) {
        setThread(await res.json())
        onThreadChanged()
      } else {
        setLoadError(await parseError(res))
      }
    } catch (err) {
      setLoadError(networkErrorMessage(err))
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
    try {
      const res = await apiFetch(`/threads/${thread.id}/assign`, { method: 'PATCH', body: JSON.stringify({ assignedToId }) })
      if (res.ok) {
        const updated = await res.json()
        setThread(prev => (prev ? { ...prev, ...updated } : prev))
        onThreadChanged()
      } else {
        showToast('error', await parseError(res))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    }
  }

  const changeStatus = async (status: string) => {
    if (!thread) return
    try {
      const res = await apiFetch(`/threads/${thread.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      if (res.ok) {
        setThread(prev => (prev ? { ...prev, status: status as ThreadDetail['status'] } : prev))
        onThreadChanged()
      } else {
        showToast('error', await parseError(res))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    }
  }

  const toggleTrash = async () => {
    if (!thread) return
    try {
      const res = await apiFetch(`/threads/${thread.id}/${thread.deletedAt ? 'restore' : 'trash'}`, { method: 'PATCH' })
      if (res.ok) {
        onThreadChanged()
        navigate(thread.deletedAt ? '/trash' : '/inbox')
      } else {
        showToast('error', await parseError(res))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={load} />

  if (loading || !thread) return <Spinner />

  const lastInbound = [...thread.messages].reverse().find(m => m.direction === 'inbound')

  return (
    <div className="flex-1 flex flex-col bg-card rounded-lg border border-border overflow-hidden min-w-0 h-full">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <div className="flex items-start gap-3">
          <Link
            to={`/${folder}`}
            className="lg:hidden flex-shrink-0 text-muted-foreground hover:text-foreground p-1 -ml-1 rounded-md hover:bg-accent transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
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
        <Button variant="secondary" className="ml-auto" onClick={toggleTrash}>
          {thread.deletedAt ? (
            <>
              <Undo2 size={14} />
              Restaurer
            </>
          ) : (
            <>
              <Trash2 size={14} />
              Supprimer
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
