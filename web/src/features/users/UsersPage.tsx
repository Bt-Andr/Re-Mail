import { useCallback, useEffect, useState } from 'react'
import { Users as UsersIcon, ShieldCheck } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Badge } from '../../components/ui/Badge'
import { SenderGrantsModal } from './SenderGrantsModal'
import type { OrgRole, OrgUser } from '../../types/api'

const ROLE_LABEL: Record<OrgRole, string> = { OWNER: 'Propriétaire', ADMIN: 'Admin', MEMBER: 'Membre' }
const ROLE_COLOR: Record<OrgRole, 'gray' | 'blue' | 'amber'> = { OWNER: 'amber', ADMIN: 'blue', MEMBER: 'gray' }

export function UsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [grantsFor, setGrantsFor] = useState<OrgUser | null>(null)

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
            {u.orgRole === 'MEMBER' && (
              <button
                type="button"
                title="Gérer les permissions d'envoi"
                onClick={() => setGrantsFor(u)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors"
              >
                <ShieldCheck size={16} />
              </button>
            )}
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
    </div>
  )
}
