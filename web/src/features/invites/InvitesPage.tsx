import { useCallback, useEffect, useState } from 'react'
import { UserPlus, Plus, Download, KeyRound, Ban } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { downloadAuthenticated } from '../../lib/download'
import { useToast } from '../../context/ToastContext'
import { formatDateTime } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Badge, statusBadgeColor } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { CreateInviteModal } from './CreateInviteModal'
import { ActivationCodeModal } from './ActivationCodeModal'
import type { UserInvite } from '../../types/api'

const STATUS_LABEL: Record<string, string> = { PENDING: 'En attente', ACTIVATED: 'Activée', REVOKED: 'Révoquée' }

export function InvitesPage() {
  const { showToast } = useToast()
  const [invites, setInvites] = useState<UserInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [codeFor, setCodeFor] = useState<UserInvite | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<UserInvite | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await apiFetch('/user-invites')
      if (res.ok) {
        setInvites(await res.json())
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

  const download = async (invite: UserInvite) => {
    try {
      await downloadAuthenticated(`/user-invites/${invite.id}/file`, `activation-${invite.username}.jep`)
    } catch {
      showToast('error', 'Téléchargement impossible.')
    }
  }

  const revoke = async () => {
    if (!revokeTarget) return
    try {
      const res = await apiFetch(`/user-invites/${revokeTarget.id}/revoke`, { method: 'POST' })
      if (res.ok) {
        showToast('success', 'Invitation révoquée.')
        void load()
      } else {
        showToast('error', await parseError(res, 'Révocation impossible.'))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    }
    setRevokeTarget(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Invitations</h1>
          <p className="text-sm text-muted-foreground">Onboarding par fichier + code : deux secrets envoyés séparément.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={15} />
          Inviter
        </Button>
      </div>

      {loading && <Spinner />}
      {!loading && loadError && <ErrorState message={loadError} onRetry={load} />}
      {!loading && !loadError && invites.length === 0 && (
        <EmptyState icon={<UserPlus size={32} />} title="Aucune invitation" message="Invitez un utilisateur non-technique par fichier + code d'activation." />
      )}

      <div className="space-y-3">
        {invites.map(invite => (
          <div key={invite.id} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">{invite.nom}</span>
                <Badge color={statusBadgeColor(invite.status)}>{STATUS_LABEL[invite.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{invite.username} · {invite.email}</p>
              <p className="text-xs text-muted-foreground/80 mt-1">Expire le {formatDateTime(invite.expiresAt)}</p>
            </div>
            {invite.status === 'PENDING' && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button type="button" title="Télécharger le fichier" onClick={() => download(invite)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors">
                  <Download size={16} />
                </button>
                <button type="button" title="Générer un code" onClick={() => setCodeFor(invite)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors">
                  <KeyRound size={16} />
                </button>
                <button type="button" title="Révoquer" onClick={() => setRevokeTarget(invite)} className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
                  <Ban size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <CreateInviteModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={emailSent => {
          setCreateOpen(false)
          showToast(
            'success',
            emailSent
              ? "Invitation créée — email envoyé à l'invité(e)."
              : "Invitation créée, mais l'email n'a pas pu être envoyé (connectez Resend et renseignez un email de contact dans Organisation). Utilisez Fichier + Code en attendant."
          )
          void load()
        }}
      />
      <ActivationCodeModal invite={codeFor} onClose={() => setCodeFor(null)} />
      <ConfirmDialog
        open={!!revokeTarget}
        title="Révoquer cette invitation ?"
        message={`${revokeTarget?.username} ne pourra plus l'utiliser pour activer un compte.`}
        danger
        confirmLabel="Révoquer"
        onConfirm={revoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  )
}
