import { useState } from 'react'
import { apiFetch, parseError } from '../../lib/apiClient'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'

const EMPTY = { username: '', email: '', nom: '', orgRole: 'MEMBER' }

export function CreateInviteModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.nom.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/user-invites', { method: 'POST', body: JSON.stringify(form) })
      if (!res.ok) {
        setError(await parseError(res, 'Impossible de créer cette invitation.'))
        return
      }
      setForm(EMPTY)
      onCreated()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Nouvelle invitation"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} loading={loading} disabled={!form.username.trim() || !form.email.trim() || !form.nom.trim()}>Créer</Button>
        </>
      }
    >
      <Input label="Nom complet" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} />
      <Input label="Nom d'utilisateur" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
      <Input label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
      <Select label="Rôle" value={form.orgRole} onChange={e => setForm(p => ({ ...p, orgRole: e.target.value }))}>
        <option value="MEMBER">Membre</option>
        <option value="ADMIN">Admin</option>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </Modal>
  )
}
