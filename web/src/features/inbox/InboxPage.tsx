import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useOrganization } from '../../hooks/useOrganization'
import { usePolling } from '../../hooks/usePolling'
import { stripHtml } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { FolderTabs, Folder } from './FolderTabs'
import { FiltersBar } from './FiltersBar'
import { ThreadListPane } from './ThreadListPane'
import { ComposerPanel, ComposerRequest } from './ComposerPanel'
import type { ThreadListItem, MailRoute } from '../../types/api'

export interface InboxOutletContext {
  openComposer: (req: ComposerRequest) => void
  onThreadChanged: () => void
}

export function InboxPage() {
  const navigate = useNavigate()
  const { organization } = useOrganization()
  const [folder, setFolder] = useState<Folder>('inbox')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [threads, setThreads] = useState<ThreadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [mailRoutes, setMailRoutes] = useState<MailRoute[]>([])
  const [composerRequest, setComposerRequest] = useState<ComposerRequest | null>(null)

  const loadThreads = useCallback(async () => {
    const params = new URLSearchParams({ folder })
    if (status !== 'all') params.set('status', status)
    try {
      const res = await apiFetch(`/threads?${params}`)
      if (res.ok) {
        setThreads(await res.json())
        setLoadError('')
      } else {
        setLoadError(await parseError(res))
      }
    } catch (err) {
      setLoadError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [folder, status])

  useEffect(() => {
    setLoading(true)
    void loadThreads()
  }, [loadThreads])

  usePolling(loadThreads, 30_000)

  useEffect(() => {
    apiFetch('/mail-routes')
      .then(async res => (res.ok ? setMailRoutes(await res.json()) : null))
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return threads
    const q = search.toLowerCase()
    return threads.filter(
      t =>
        t.sujet.toLowerCase().includes(q) ||
        t.externalFrom.toLowerCase().includes(q) ||
        t.externalEmail.toLowerCase().includes(q) ||
        stripHtml(t.lastMessage?.body ?? '').toLowerCase().includes(q)
    )
  }, [threads, search])

  const unreadCount = threads.reduce((sum, t) => sum + t.unreadCount, 0)

  const outletContext: InboxOutletContext = {
    openComposer: setComposerRequest,
    onThreadChanged: loadThreads,
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-110px)]">
      <div className="flex flex-col gap-2 w-80 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <FolderTabs folder={folder} unreadCount={unreadCount} onChange={f => { setFolder(f); navigate('/inbox') }} />
          </div>
        </div>
        <Button onClick={() => setComposerRequest({ mode: 'new' })} className="w-full">
          <Send size={14} />
          Nouveau mail
        </Button>
        <FiltersBar search={search} onSearch={setSearch} status={status} onStatus={setStatus} />
        <ThreadListPane
          threads={filtered}
          loading={loading}
          error={loadError}
          onRetry={loadThreads}
          folder={folder}
          mailRoutes={mailRoutes}
          resendConnected={!!organization?.resendConnected}
        />
      </div>

      <Outlet context={outletContext} />

      <ComposerPanel
        request={composerRequest}
        onClose={() => setComposerRequest(null)}
        onSent={threadId => {
          setComposerRequest(null)
          void loadThreads()
          navigate(`/inbox/${threadId}`)
        }}
      />
    </div>
  )
}
