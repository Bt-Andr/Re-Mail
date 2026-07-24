import { useState, useEffect } from 'react'
import { apiFetch, parseError } from '../../lib/apiClient'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import type { MailRoute } from '../../types/api'

interface MailRouteFormModalProps {
  open: boolean
  editing: MailRoute | null
  onClose: () => void
  onSaved: () => void
}

export function MailRouteFormModal({ open, editing, onClose, onSaved }: MailRouteFormModalProps) {
  const [form, setForm] = useState({ alias: '', personalEmail: '', displayName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setForm(editing ? { alias: editing.alias, personalEmail: editing.personalEmail, displayName: editing.displayName || '' } : { alias: '', personalEmail: '', displayName: '' })
    setError('')
  }, [editing, open])

  const submit = async () => {
    if (!form.alias.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = editing
        ? await apiFetch(`/mail-routes/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : await apiFetch('/mail-routes', { method: 'POST', body: JSON.stringify(form) })
      if (!res.ok) {
        setError(await parseError(res, 'Impossible d\'enregistrer.'))
        return
      }
      onSaved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Modifier l\'adresse' : 'Nouvelle adresse'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} loading={loading} disabled={!form.alias.trim()}>Enregistrer</Button>
        </>
      }
    >
      <Input label="Adresse" placeholder="contact@votredomaine.com" value={form.alias} onChange={e => setForm(p => ({ ...p, alias: e.target.value }))} />
      <Input label="Transférer vers (optionnel)" placeholder="vous@gmail.com" type="email" value={form.personalEmail} onChange={e => setForm(p => ({ ...p, personalEmail: e.target.value }))} />
      <Input label="Nom affiché (optionnel)" placeholder="Service Commercial" value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </Modal>
  )
}