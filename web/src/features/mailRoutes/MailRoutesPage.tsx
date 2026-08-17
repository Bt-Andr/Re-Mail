import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, Pencil, Trash2, Plus, Upload } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useToast } from '../../context/ToastContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { MailRouteFormModal } from './MailRouteFormModal'
import { BulkImportModal } from './BulkImportModal'
import type { MailRoute } from '../../types/api'

export function MailRoutesPage() {
  const { showToast } = useToast()
  const [routes, setRoutes] = useState<MailRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [modal, setModal] = useState<{ open: boolean; editing: MailRoute | null }>({ open: false, editing: null })
  const [importOpen, setImportOpen] = useState(false)
  const [toDelete, setToDelete] = useState<MailRoute | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await apiFetch('/mail-routes')
      if (res.ok) {
        setRoutes(await res.json())
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

  const toggleActive = async (route: MailRoute) => {
    try {
      const res = await apiFetch(`/mail-routes/${route.id}`, { method: 'PUT', body: JSON.stringify({ ...route, active: !route.active }) })
      if (res.ok) {
        setRoutes(prev => prev.map(r => (r.id === route.id ? { ...r, active: !r.active } : r)))
      } else {
        showToast('error', await parseError(res))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    try {
      const res = await apiFetch(`/mail-routes/${toDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        setRoutes(prev => prev.filter(r => r.id !== toDelete.id))
        showToast('success', 'Adresse supprimée.')
      } else {
        showToast('error', await parseError(res, 'Suppression impossible.'))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    }
    setToDelete(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Adresses mail</h1>
          <p className="text-sm text-muted-foreground">Alias @votredomaine.com et notification personnelle associée.</p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            Créer une adresse ne suffit pas à l'assigner : les rôles Propriétaire/Admin y ont accès automatiquement,
            mais chaque Membre doit recevoir la permission d'envoi individuellement depuis{' '}
            <Link to="/settings/users" className="underline font-medium">Utilisateurs</Link>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload size={15} />
            Importer
          </Button>
          <Button onClick={() => setModal({ open: true, editing: null })}>
            <Plus size={15} />
            Ajouter
          </Button>
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && loadError && <ErrorState message={loadError} onRetry={load} />}
      {!loading && !loadError && routes.length === 0 && (
        <EmptyState icon={<AtSign size={32} />} title="Aucune adresse configurée" message="Ajoutez une première adresse pour commencer à recevoir des emails." />
      )}

      <div className="space-y-3">
        {routes.map(route => (
          <div key={route.id} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
              <AtSign className="text-foreground" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-foreground">{route.alias}</span>
                {route.personalEmail ? (
                  <>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-sm text-muted-foreground">{route.personalEmail}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/70 italic">Transfert non configuré</span>
                )}
                {route.displayName && <span className="text-xs text-muted-foreground/80">({route.displayName})</span>}
              </div>
              <button type="button" onClick={() => toggleActive(route)} className="mt-1 block">
                <Badge color={route.active ? 'green' : 'gray'}>{route.active ? 'Active' : 'Inactive'}</Badge>
              </button>
            </div>
            <button type="button" title="Modifier" onClick={() => setModal({ open: true, editing: route })} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors">
              <Pencil size={15} />
            </button>
            <button type="button" title="Supprimer" onClick={() => setToDelete(route)} className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <MailRouteFormModal
        open={modal.open}
        editing={modal.editing}
        onClose={() => setModal({ open: false, editing: null })}
        onSaved={() => {
          setModal({ open: false, editing: null })
          showToast('success', 'Adresse enregistrée.')
          void load()
        }}
      />
      <BulkImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void load()}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer cette adresse ?"
        message={`${toDelete?.alias} ne recevra plus de nouveaux emails.`}
        danger
        confirmLabel="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
