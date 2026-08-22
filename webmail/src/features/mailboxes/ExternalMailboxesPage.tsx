import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AtSign, CheckCircle2, History, Mail, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAccountSwitcher } from '../../context/AccountSwitcherContext'
import { useAccountContext } from '../../hooks/useAccountContext'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { MailboxConnectionFormModal, MAILBOX_PRESETS } from './MailboxConnectionFormModal'
import { ProviderPickerModal, type MailboxProvider } from './ProviderPickerModal'
import { ResendConnectModal } from './ResendConnectModal'
import type { ExternalMailboxConnection, ProAddress } from '../../types/api'

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
  const { refetch: refetchAccounts } = useAccountSwitcher()
  const { isManager } = useAccountContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [connections, setConnections] = useState<ExternalMailboxConnection[]>([])
  const [proAddresses, setProAddresses] = useState<ProAddress[]>([])
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [resendOpen, setResendOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formPreset, setFormPreset] = useState<Partial<(typeof MAILBOX_PRESETS)[string]> | undefined>(undefined)
  const [toDelete, setToDelete] = useState<ExternalMailboxConnection | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [toImport, setToImport] = useState<ExternalMailboxConnection | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)

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

  const selectProvider = (provider: MailboxProvider) => {
    setPickerOpen(false)
    if (provider === 'google') {
      void connectGmail()
      return
    }
    if (provider === 'resend') {
      setResendOpen(true)
      return
    }
    setFormPreset(provider === 'other' ? undefined : MAILBOX_PRESETS[provider])
    setFormOpen(true)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [connRes, proRes] = await Promise.all([apiFetch('/mailbox-connections'), apiFetch('/pro-addresses/mine')])
      if (connRes.ok) {
        setConnections(await connRes.json())
      } else {
        setLoadError(await parseError(connRes))
      }
      // Silencieux si /pro-addresses/mine échoue (ex. org sans domaine vérifié renvoie
      // déjà []) : ne bloque jamais l'affichage des vraies boîtes connectées pour ça.
      if (proRes.ok) setProAddresses(await proRes.json())
    } catch (err) {
      setLoadError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const claim = async (address: ProAddress) => {
    setClaimingId(address.id)
    try {
      const res = await apiFetch(`/pro-addresses/${address.id}/claim`, { method: 'POST' })
      if (res.ok) {
        setProAddresses(prev => prev.map(a => (a.id === address.id ? { ...a, claimedAt: new Date().toISOString() } : a)))
        showToast('success', `${address.email} connectée.`)
        refetchAccounts()
      } else {
        showToast('error', await parseError(res, 'Connexion impossible.'))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    } finally {
      setClaimingId(null)
    }
  }

  const retry = async (connection: ExternalMailboxConnection) => {
    setRetryingId(connection.id)
    try {
      const res = await apiFetch(`/mailbox-connections/${connection.id}/retry`, { method: 'PATCH' })
      if (res.ok) {
        showToast('success', 'Nouvelle tentative programmée.')
        void load()
        refetchAccounts()
      } else {
        showToast('error', await parseError(res))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    } finally {
      setRetryingId(null)
    }
  }

  // 30 jours, borné côté serveur (HISTORY_IMPORT_MIN_DAYS/MAX_DAYS) — action ponctuelle
  // par connexion, jamais rejouable une fois historyImportedAt posé (voir bouton masqué
  // plus bas et 409 côté serveur en cas de second appel).
  const confirmImport = async () => {
    if (!toImport) return
    const connection = toImport
    setImportingId(connection.id)
    try {
      const res = await apiFetch(`/mailbox-connections/${connection.id}/import-history`, {
        method: 'POST',
        body: JSON.stringify({ days: 30 }),
      })
      if (res.ok) {
        const { imported } = await res.json()
        showToast('success', imported > 0 ? `${imported} mail${imported > 1 ? 's' : ''} importé${imported > 1 ? 's' : ''}.` : 'Aucun mail à importer sur cette période.')
        void load()
      } else {
        showToast('error', await parseError(res, "Import de l'historique impossible."))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    } finally {
      setImportingId(null)
      setToImport(null)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    try {
      const res = await apiFetch(`/mailbox-connections/${toDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        setConnections(prev => prev.filter(c => c.id !== toDelete.id))
        showToast('success', 'Boîte déconnectée.')
        refetchAccounts()
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
        {!loading && proAddresses.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-foreground mb-1">Adresses pro</h2>
            <p className="text-xs text-muted-foreground mb-3">Attribuées par un administrateur — connectez-les pour les voir dans votre boîte.</p>
            <div className="space-y-3">
              {proAddresses.map(address => (
                <div key={address.id} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                    <AtSign className="text-foreground" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm font-semibold text-foreground">{address.email}</span>
                  </div>
                  {address.claimedAt ? (
                    <Badge color="green">
                      <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Connectée</span>
                    </Badge>
                  ) : (
                    <Button variant="secondary" onClick={() => void claim(address)} loading={claimingId === address.id}>
                      Connecter
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold">Boîtes externes</h1>
            <p className="text-sm text-muted-foreground">Connectez un Gmail, Outlook ou toute autre boîte mail existante.</p>
          </div>
          <Button onClick={() => setPickerOpen(true)} loading={connectingGmail}>
            <Plus size={15} />
            Connecter
          </Button>
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
              {connection.status === 'connected' && !connection.historyImportedAt && (
                <button
                  type="button"
                  title="Importer l'historique (30 derniers jours)"
                  onClick={() => setToImport(connection)}
                  disabled={importingId === connection.id}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <History size={15} className={importingId === connection.id ? 'animate-pulse' : ''} />
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

        <ProviderPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={selectProvider} showResend={isManager} />
        {resendOpen && (
          // Montée seulement à l'ouverture (pas toujours rendue comme les autres modales) :
          // useOrganization() à l'intérieur ferait sinon un GET /organizations/me à chaque
          // visite de /mailboxes, même quand personne n'ouvre jamais ce picker.
          <ResendConnectModal
            open={resendOpen}
            onClose={() => setResendOpen(false)}
            onConnected={() => {
              showToast('success', 'Resend connecté.')
              refetchAccounts()
            }}
          />
        )}
        <MailboxConnectionFormModal
          open={formOpen}
          preset={formPreset}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            showToast('success', 'Boîte connectée.')
            void load()
            refetchAccounts()
          }}
        />
        <ConfirmDialog
          open={!!toImport}
          title="Importer l'historique ?"
          message={`Récupère les mails déjà présents dans ${toImport?.email} (30 derniers jours). Une seule fois par boîte.`}
          confirmLabel="Importer"
          loading={!!toImport && importingId === toImport.id}
          onConfirm={confirmImport}
          onCancel={() => setToImport(null)}
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
