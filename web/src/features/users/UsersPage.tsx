import { useCallback, useEffect, useState } from 'react'
import { Crown, Users as UsersIcon, ShieldCheck } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { SenderGrantsModal } from './SenderGrantsModal'
import type { OrgRole, OrgUser } from '../../types/api'

const ROLE_LABEL: Record<OrgRole, string> = { OWNER: 'Propriétaire', ADMIN: 'Admin', MEMBER: 'Membre' }
const ROLE_COLOR: Record<OrgRole, 'gray' | 'blue' | 'amber'> = { OWNER: 'amber', ADMIN: 'blue', MEMBER: 'gray' }

export function UsersPage() {
  const { user: sessionUser } = useSession()
  const [users, setUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [grantsFor, setGrantsFor] = useState<OrgUser | null>(null)
  const [ownerCandidate, setOwnerCandidate] = useState<OrgUser | null>(null)
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await apiFetch('/users')
      if (res.ok) {
        setUsers(await res.json())
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

  const currentMembership = users.find(member => member.id === sessionUser?.id)
  const canTransferOwnership = currentMembership?.orgRole === 'OWNER'

  const transferOwnership = useCallback(async () => {
    if (!ownerCandidate) return

    setTransferring(true)
    setTransferError('')
    try {
      const res = await apiFetch(`/users/${ownerCandidate.id}/transfer-ownership`, { method: 'POST' })
      if (!res.ok) {
        setTransferError(await parseError(res))
        return
      }
      setOwnerCandidate(null)
      await load()
    } catch (err) {
      setTransferError(networkErrorMessage(err))
    } finally {
      setTransferring(false)
    }
  }, [load, ownerCandidate])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">Membres de l'organisation et permissions d'envoi par adresse.</p>
      </div>

      {loading && <Spinner />}
      {!loading && loadError && <ErrorState message={loadError} onRetry={load} />}
      {!loading && !loadError && users.length === 0 && <EmptyState icon={<UsersIcon size={32} />} title="Aucun utilisateur" />}

      <div className="space-y-3">
        {transferError && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {transferError}
          </p>
        )}
        {users.map(u => (
          <div key={u.id} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">{u.nom}</span>
                <Badge color={ROLE_COLOR[u.orgRole]}>{ROLE_LABEL[u.orgRole]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{u.username} · {u.email}</p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                {u.orgRole === 'MEMBER'
                  ? u.senderGrants.length > 0
                    ? `Peut envoyer depuis ${u.senderGrants.length} adresse${u.senderGrants.length > 1 ? 's' : ''}`
                    : "Aucune permission d'envoi"
                  : `Accès à toutes les adresses (rôle ${ROLE_LABEL[u.orgRole].toLowerCase()})`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {canTransferOwnership && u.id !== sessionUser?.id && u.orgRole !== 'OWNER' && (
                <button
                  type="button"
                  title="Transférer la propriété"
                  aria-label={`Transférer la propriété à ${u.nom}`}
                  onClick={() => {
                    setTransferError('')
                    setOwnerCandidate(u)
                  }}
                  className="text-amber-600 hover:text-amber-700 p-1.5 rounded-md hover:bg-amber-50 transition-colors"
                >
                  <Crown size={16} />
                </button>
              )}
              {u.orgRole === 'MEMBER' && (
                <button
                  type="button"
                  title="Gérer les permissions d'envoi"
                  aria-label={`Gérer les permissions d'envoi de ${u.nom}`}
                  onClick={() => setGrantsFor(u)}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors"
                >
                  <ShieldCheck size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <SenderGrantsModal
        user={grantsFor}
        onClose={() => setGrantsFor(null)}
        onSaved={updated => {
          setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)))
          setGrantsFor(null)
        }}
      />
      <ConfirmDialog
        open={ownerCandidate !== null}
        title="Transférer la propriété"
        message={transferError || `Confirmer le transfert à ${ownerCandidate?.nom ?? ''} ? Vous deviendrez administrateur et cette personne sera l'unique propriétaire de l'organisation.`}
        confirmLabel="Transférer"
        danger
        loading={transferring}
        onConfirm={() => void transferOwnership()}
        onCancel={() => {
          if (!transferring) setOwnerCandidate(null)
        }}
      />
    </div>
  )
}
