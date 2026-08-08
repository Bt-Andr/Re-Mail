import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { Send } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useOrganization } from '../../hooks/useOrganization'
import { usePolling } from '../../hooks/usePolling'
import { Button } from '../../components/ui/Button'
import { FiltersBar } from './FiltersBar'
import { ThreadListPane } from './ThreadListPane'
import { ComposerPanel, ComposerRequest } from './ComposerPanel'
import type { ThreadListItem, MailRoute } from '../../types/api'

export type Folder = 'inbox' | 'sent' | 'trash'

export interface InboxOutletContext {
  openComposer: (req: ComposerRequest) => void
  onThreadChanged: () => void
  folder: Folder
}

// `folder` vient de la route (/inbox, /sent, /trash — voir App.tsx) plutôt que d'un
// onglet interne : la sidebar liste directement les dossiers, comme Gmail, au lieu
// d'un item générique "Boîte de réception" qui cachait un second niveau de nav.
export function InboxPage({ folder }: { folder: Folder }) {
  const navigate = useNavigate()
  // Un thread sélectionné (route enfant :threadId active) — sert à basculer entre
  // liste et détail sur petit écran, où les deux ne peuvent pas tenir côte à côte.
  const { threadId: selectedThreadId } = useParams<{ threadId?: string }>()
  const { organization } = useOrganization()
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [threads, setThreads] = useState<ThreadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [mailRoutes, setMailRoutes] = useState<MailRoute[]>([])
  const [composerRequest, setComposerRequest] = useState<ComposerRequest | null>(null)

  // Recherche côté serveur (sujet/expéditeur/corps des messages) — débouncée pour
  // ne pas déclencher une requête à chaque frappe.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  const loadThreads = useCallback(async () => {
    const params = new URLSearchParams({ folder })
    if (status !== 'all') params.set('status', status)
    if (debouncedSearch) params.set('q', debouncedSearch)
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
  }, [folder, status, debouncedSearch])

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

  const outletContext: InboxOutletContext = {
    openComposer: setComposerRequest,
    onThreadChanged: loadThreads,
    folder,
  }

  // Sous lg : un seul panneau visible à la fois (liste OU détail), comme un client
  // mail mobile — au-dessus, les deux côte à côte comme avant.
  return (
    <div className="flex gap-4 h-[calc(100vh-110px)]">
      <div
        className={`flex-col gap-2 w-full lg:w-80 lg:flex-shrink-0 ${selectedThreadId ? 'hidden lg:flex' : 'flex'}`}
      >
        <Button onClick={() => setComposerRequest({ mode: 'new' })} className="w-full">
          <Send size={14} />
          Nouveau mail
        </Button>
        <FiltersBar search={search} onSearch={setSearch} status={status} onStatus={setStatus} />
        <ThreadListPane
          threads={threads}
          loading={loading}
          error={loadError}
          onRetry={loadThreads}
          folder={folder}
          mailRoutes={mailRoutes}
          resendConnected={!!organization?.resendConnected}
          searching={!!debouncedSearch}
        />
      </div>

      <div className={`min-w-0 flex-1 ${selectedThreadId ? 'flex' : 'hidden lg:flex'}`}>
        <Outlet context={outletContext} />
      </div>

      <ComposerPanel
        request={composerRequest}
        onClose={() => setComposerRequest(null)}
        onSent={threadId => {
          setComposerRequest(null)
          void loadThreads()
          navigate(`/${folder}/${threadId}`)
        }}
      />
    </div>
  )
}
