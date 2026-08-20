import { useCallback, useEffect, useState } from 'react'
import { AtSign, Pencil, Trash2, Plus, CheckCircle2, Clock } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useToast } from '../../context/ToastContext'
import { useOrganization } from '../../hooks/useOrganization'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ProAddressFormModal } from './ProAddressFormModal'
import type { OrgUser, StagedRoutingRule, ThreadRoutingRule } from '../../types/api'

// Une "adresse pro" côté produit EST une ThreadRoutingRule — créer et attribuer ici, la
// personne assignée la connecte ensuite elle-même depuis son picker (comme un Gmail),
// voir GET /pro-addresses/mine côté webmail/mobile. Contrairement à Adresses mail
// (MailRoute, pur transfert), une adresse pro conditionne l'assignation des threads.
export function ProAddressesPage() {
  const { showToast } = useToast()
  const { organization } = useOrganization()
  const [rules, setRules] = useState<ThreadRoutingRule[]>([])
  const [users, setUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [modal, setModal] = useState<{ open: boolean; editing: ThreadRoutingRule | null }>({ open: false, editing: null })
  const [toDelete, setToDelete] = useState<ThreadRoutingRule | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [rulesRes, usersRes] = await Promise.all([apiFetch('/thread-routing-rules'), apiFetch('/users')])
      if (rulesRes.ok && usersRes.ok) {
        setRules(await rulesRes.json())
        setUsers(await usersRes.json())
      } else {
        setLoadError(await parseError(rulesRes.ok ? usersRes : rulesRes))
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

  const confirmDelete = async () => {
    if (!toDelete) return
    try {
      const res = await apiFetch(`/thread-routing-rules/${encodeURIComponent(toDelete.canal)}`, { method: 'DELETE' })
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== toDelete.id))
        showToast('success', 'Adresse supprimée.')
      } else {
        showToast('error', await parseError(res, 'Suppression impossible.'))
      }
    } catch (err) {
      showToast('error', networkErrorMessage(err))
    }
    setToDelete(null)
  }

  const onSaved = (result: ThreadRoutingRule | StagedRoutingRule) => {
    setModal({ open: false, editing: null })
    if ('staged' in result) {
      showToast('success', `En attente — sera active dès l'activation du compte de ${result.invite.nom}.`)
    } else {
      showToast('success', 'Adresse créée.')
      void load()
    }
  }

  const domain = organization?.resendVerifiedDomain

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Adresses pro</h1>
          <p className="text-sm text-muted-foreground">
            Créez une adresse sous votre domaine et attribuez-la à une personne — elle la connecte ensuite
            elle-même, comme un Gmail.
          </p>
        </div>
        <Button onClick={() => setModal({ open: true, editing: null })} disabled={!domain}>
          <Plus size={15} />
          Ajouter
        </Button>
      </div>

      {!loading && !domain && (
        <EmptyState
          icon={<AtSign size={32} />}
          title="Aucun domaine Resend vérifié"
          message="Connectez Resend et vérifiez un domaine depuis Organisation avant de créer une adresse pro."
        />
      )}

      {loading && <Spinner />}
      {!loading && loadError && <ErrorState message={loadError} onRetry={load} />}
      {!loading && !loadError && domain && rules.length === 0 && (
        <EmptyState icon={<AtSign size={32} />} title="Aucune adresse pro configurée" message="Créez-en une pour commencer à en attribuer une à quelqu'un." />
      )}

      {domain && (
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                <AtSign className="text-foreground" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-foreground">{rule.canal}@{domain}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-sm text-muted-foreground">{rule.assignTo.nom}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {rule.claimedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 size={12} /> Connectée
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <Clock size={12} /> En attente de connexion
                    </span>
                  )}
                  {!rule.active && <span className="text-xs text-muted-foreground">· Inactive</span>}
                </div>
              </div>
              <button type="button" title="Réattribuer" onClick={() => setModal({ open: true, editing: rule })} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors">
                <Pencil size={15} />
              </button>
              <button type="button" title="Supprimer" onClick={() => setToDelete(rule)} className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {domain && (
        <ProAddressFormModal
          open={modal.open}
          domain={domain}
          users={users}
          editing={modal.editing}
          onClose={() => setModal({ open: false, editing: null })}
          onSaved={onSaved}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer cette adresse ?"
        message={`${toDelete?.canal}@${domain} ne sera plus assignée à personne — les threads déjà reçus ne sont pas affectés.`}
        danger
        confirmLabel="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
