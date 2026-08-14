import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mail, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { MailboxConnectionFormModal } from './MailboxConnectionFormModal'
import type { ExternalMailboxConnection } from '../../types/api'

const GMAIL_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: 'Consentement Google annulé.',
  state_invalid: 'La demande de connexion a expiré, réessayez.',
  token_exchange_failed: 'La connexion à Google a échoué.',
  already_connected_by_another_user: 'Cette adresse Gmail est déjà connectée par un autre membre de votre organisation.',
}

// Accessible à TOUT utilisateur authentifié (pas seulement OWNER/ADMIN) — c'est un
// identifiant personnel, pas une ressource d'équipe comme les adresses mail de l'org
// (voir /settings/mail-routes) : ne vit donc pas sous /settings, qui est réservé aux
// managers d'une org pro (RoleGuard exclut aussi les comptes perso, voir App.tsx).
export function ExternalMailboxesPage() {
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [connections, setConnections] = useState<ExternalMailboxConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [toDelete, setToDelete] = useState<ExternalMailboxConnection | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [connectingGmail, setConnectingGmail] = useState(false)

  // Retour de /gmail/callback (succès sans erreur → juste un rechargement de la liste
  // via le `load` normal ; échec → ?error=... à traduire et effacer de l'URL).
  useEffect(() => {
    const error = searchParams.get('error')
    if (!error) return
    showToast('error', GMAIL_ERROR_MESSAGES[error] ?? 'La connexion Gmail a échoué.')
    setSearchParams(
      prev => {
        prev.delete('error')
        return prev
      },
      { replace: true }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const connectGmail = async () => {
    setConnectingGmail(true)
    try {
      const returnTo = `${window.location.origin}/mailboxes`
      const res = await apiFetch(`/mailbox-connections/gmail/start?returnTo=${encodeURIComponent(returnTo)}`)
      if (!res.ok) {
        showToast('error', await parseError(res, 'Connexion Gmail indisponible.'))
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      showToast('error', networkErrorMessage(err))
      setConnectingGmail(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await apiFetch('/mailbox-connections')
      if (res.ok) {
        setConnections(await res.json())
      } else {
        setLoadError(await parseError(res))
      }
    } catch (err) {
      setLoadError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const retry = async (connection: ExternalMailboxConnection) => {
    setRetryingId(connection.id)
    try {
      const res = await apiFetch(`/mailbox-connections/${connection.id}/retry`, { method: 'PATCH' })
      if (res.ok) {
        showToast('success', 'Nouvelle tentative programmée.')
        void load()
      } else {
        showToast('error', await parseError(res))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    } finally {
      setRetryingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    try {
      const res = await apiFetch(`/mailbox-connections/${toDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        setConnections(prev => prev.filter(c => c.id !== toDelete.id))
        showToast('success', 'Boîte déconnectée.')
      } else {
        showToast('error', await parseError(res, 'Suppression impossible.'))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    }
    setToDelete(null)
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold">Boîtes externes</h1>
            <p className="text-sm text-muted-foreground">Connectez un Gmail, Outlook ou toute autre boîte mail existante.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void connectGmail()} loading={connectingGmail}>
              Connecter Gmail
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={15} />
              Connecter
            </Button>
          </div>
        </div>

        {loading && <Spinner />}
        {!loading && loadError && <ErrorState message={loadError} onRetry={load} />}
        {!loading && !loadError && connections.length === 0 && (
          <EmptyState
            icon={<Mail size={32} />}
            title="Aucune boîte connectée"
            message="Connectez votre Gmail, Outlook ou toute autre adresse pour l'utiliser dans l'app."
          />
        )}

        <div className="space-y-3">
          {connections.map(connection => (
            <div key={connection.id} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                <Mail className="text-foreground" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-foreground">{connection.email}</span>
                  <Badge color={connection.status === 'connected' ? 'green' : 'red'}>
                    {connection.status === 'connected' ? 'Connectée' : 'Erreur'}
                  </Badge>
                </div>
                {connection.status === 'error' && connection.lastError && (
                  <p className="text-xs text-destructive mt-1">{connection.lastError}</p>
                )}
              </div>
              {connection.status === 'error' && (
                <button
                  type="button"
                  title="Réessayer"
                  onClick={() => void retry(connection)}
                  disabled={retryingId === connection.id}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={15} className={retryingId === connection.id ? 'animate-spin' : ''} />
                </button>
              )}
              <button
                type="button"
                title="Supprimer"
                onClick={() => setToDelete(connection)}
                className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <MailboxConnectionFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            showToast('success', 'Boîte connectée.')
            void load()
          }}
        />
        <ConfirmDialog
          open={!!toDelete}
          title="Déconnecter cette boîte ?"
          message={`${toDelete?.email} ne sera plus consultable dans l'app.`}
          danger
          confirmLabel="Déconnecter"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      </div>
    </div>
  )
}
