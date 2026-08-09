import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { Send } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useOrganization } from '../../hooks/useOrganization'
import { usePolling } from '../../hooks/usePolling'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { FiltersBar } from './FiltersBar'
import { ThreadListPane } from './ThreadListPane'
import { BulkActionBar, type BulkPatch } from './BulkActionBar'
import { ComposerPanel, ComposerRequest } from './ComposerPanel'
import type { ThreadListItem, MailRoute } from '../../types/api'

export type Folder = 'inbox' | 'sent' | 'archive' | 'trash'

const PAGE_SIZE = 30

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
  const { showToast } = useToast()
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [threads, setThreads] = useState<ThreadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [mailRoutes, setMailRoutes] = useState<MailRoute[]>([])
  const [composerRequest, setComposerRequest] = useState<ComposerRequest | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Recherche côté serveur (sujet/expéditeur/corps des messages) — débouncée pour
  // ne pas déclencher une requête à chaque frappe.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  // Page unique (skip/take) plutôt qu'un fil complet d'un coup — évite de charger
  // des milliers de threads en une requête sur une boîte qui grossit. `loadFirstPage`
  // remplace la liste (filtre changé, poll périodique) ; `loadMore` accumule au scroll.
  const fetchPage = useCallback(
    async (skip: number): Promise<{ ok: true; data: ThreadListItem[] } | { ok: false; error: string }> => {
      const params = new URLSearchParams({ folder, take: String(PAGE_SIZE), skip: String(skip) })
      if (status !== 'all') params.set('status', status)
      if (debouncedSearch) params.set('q', debouncedSearch)
      const res = await apiFetch(`/threads?${params}`)
      if (res.ok) return { ok: true, data: await res.json() }
      return { ok: false, error: await parseError(res) }
    },
    [folder, status, debouncedSearch]
  )

  const loadFirstPage = useCallback(async () => {
    try {
      const result = await fetchPage(0)
      if (result.ok) {
        setThreads(result.data)
        setHasMore(result.data.length === PAGE_SIZE)
        setLoadError('')
      } else {
        setLoadError(result.error)
      }
    } catch (err) {
      setLoadError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  useEffect(() => {
    setLoading(true)
    setSelectedIds(new Set())
    void loadFirstPage()
  }, [loadFirstPage])

  usePolling(loadFirstPage, 30_000)

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const result = await fetchPage(threads.length)
      if (result.ok) {
        setThreads(prev => [...prev, ...result.data])
        setHasMore(result.data.length === PAGE_SIZE)
      } else {
        setHasMore(false)
        showToast('error', result.error)
      }
    } catch (err) {
      setHasMore(false)
      showToast('error', networkErrorMessage(err))
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, threads.length, hasMore, loadingMore, showToast])

  // Optimiste : l'étoile est un marqueur personnel à faible enjeu (comme dans
  // Gmail), pas besoin d'attendre la réponse serveur ni de recharger la page —
  // on revient juste en arrière si l'appel échoue.
  const toggleStar = useCallback(
    async (threadId: string, starred: boolean) => {
      setThreads(prev => prev.map(t => (t.id === threadId ? { ...t, starred } : t)))
      try {
        const res = await apiFetch(`/threads/${threadId}/star`, { method: 'PATCH', body: JSON.stringify({ starred }) })
        if (!res.ok) {
          setThreads(prev => prev.map(t => (t.id === threadId ? { ...t, starred: !starred } : t)))
          showToast('error', await parseError(res))
        }
      } catch (err) {
        setThreads(prev => prev.map(t => (t.id === threadId ? { ...t, starred: !starred } : t)))
        showToast('error', networkErrorMessage(err))
      }
    },
    [showToast]
  )

  const toggleSelect = useCallback((threadId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(threadId)) next.delete(threadId)
      else next.add(threadId)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // Les ids qui ne sont plus dans la sélection après l'action groupée (statut
  // changé sans quitter le dossier => reste visible ; archivage/corbeille => quitte
  // le dossier courant) sont retirés localement plutôt que d'attendre le prochain
  // rechargement, pour un retour visuel immédiat.
  const bulkAction = useCallback(
    async (patch: BulkPatch) => {
      const ids = [...selectedIds]
      if (ids.length === 0) return
      try {
        const res = await apiFetch('/threads/bulk', { method: 'PATCH', body: JSON.stringify({ ids, ...patch }) })
        if (res.ok) {
          clearSelection()
          void loadFirstPage()
        } else {
          showToast('error', await parseError(res))
        }
      } catch (err) {
        showToast('error', networkErrorMessage(err))
      }
    },
    [selectedIds, clearSelection, loadFirstPage, showToast]
  )

  useEffect(() => {
    apiFetch('/mail-routes')
      .then(async res => (res.ok ? setMailRoutes(await res.json()) : null))
      .catch(() => {})
  }, [])

  const outletContext: InboxOutletContext = {
    openComposer: setComposerRequest,
    onThreadChanged: loadFirstPage,
    folder,
  }

  // Sous lg : un seul panneau visible à la fois (liste OU détail), comme un client
  // mail mobile — au-dessus, les deux côte à côte comme avant.
  return (
    <div className="flex gap-4 h-[calc(100vh-110px)]">
      <div
        className={`flex-col gap-2 w-full lg:w-80 lg:flex-shrink-0 ${selectedThreadId ? 'hidden lg:flex' : 'flex'}`}
      >
        {selectedIds.size > 0 ? (
          <BulkActionBar folder={folder} count={selectedIds.size} onClear={clearSelection} onAction={bulkAction} />
        ) : (
          <>
            <Button onClick={() => setComposerRequest({ mode: 'new' })} className="w-full">
              <Send size={14} />
              Nouveau mail
            </Button>
            <FiltersBar search={search} onSearch={setSearch} status={status} onStatus={setStatus} />
          </>
        )}
        <ThreadListPane
          threads={threads}
          loading={loading}
          error={loadError}
          onRetry={loadFirstPage}
          folder={folder}
          mailRoutes={mailRoutes}
          resendConnected={!!organization?.resendConnected}
          searching={!!debouncedSearch}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          onToggleStar={toggleStar}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
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
          void loadFirstPage()
          navigate(`/${folder}/${threadId}`)
        }}
      />
    </div>
  )
}
