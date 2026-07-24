import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/apiClient'
import { useToast } from '../../context/ToastContext'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import type { MailRoute, OrgUser } from '../../types/api'

export function SenderGrantsModal({ user, onClose, onSaved }: { user: OrgUser | null; onClose: () => void; onSaved: (user: OrgUser) => void }) {
  const { showToast } = useToast()
  const [routes, setRoutes] = useState<MailRoute[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setSelected(new Set(user.senderGrants.map(g => g.email.toLowerCase())))
    setLoading(true)
    apiFetch('/mail-routes')
      .then(async res => {
        if (res.ok) setRoutes(await res.json())
      })
      .finally(() => setLoading(false))
  }, [user])

  if (!user) return null

  const toggle = (alias: string) => {
    const key = alias.toLowerCase()
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiFetch(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ grantedSenders: [...selected] }) })
      if (!res.ok) {
        showToast('error', 'Enregistrement impossible.')
        return
      }
      const updated = await res.json()
      showToast('success', 'Permissions mises à jour.')
      onSaved(updated)
    } finally {
      setSaving(false)
    }
  }

  const activeRoutes = routes.filter(r => r.active)

  return (
    <Modal
      open
      title={`Permissions d'envoi — ${user.nom}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} loading={saving}>Enregistrer</Button>
        </>
      }
    >
      {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!loading && activeRoutes.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune adresse configurée. Ajoutez-en depuis « Adresses mail ».</p>
      )}
      {!loading && activeRoutes.length > 0 && (
        <div className="space-y-2">
          {activeRoutes.map(r => (
            <label
              key={r.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border hover:bg-accent cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(r.alias.toLowerCase())}
                onChange={() => toggle(r.alias)}
                className="rounded border-input text-primary focus:ring-2 focus:ring-ring/30"
              />
              <span className="text-sm font-mono text-foreground">{r.alias}</span>
              {r.displayName && <span className="text-xs text-muted-foreground">({r.displayName})</span>}
            </label>
          ))}
        </div>
      )}
    </Modal>
  )
}
