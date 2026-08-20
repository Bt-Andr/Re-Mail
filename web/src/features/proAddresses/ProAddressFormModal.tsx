import { useEffect, useState } from 'react'
import { apiFetch, parseError } from '../../lib/apiClient'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import type { OrgUser, StagedRoutingRule, ThreadRoutingRule } from '../../types/api'

interface ProAddressFormModalProps {
  open: boolean
  domain: string
  users: OrgUser[]
  // Non nul = réattribuer une adresse existante : le canal (donc le routage des threads
  // déjà reçus) ne bouge pas, seul assignTo change. PUT /:canal fait déjà l'upsert par
  // canal côté backend — même endpoint, juste un canal pré-rempli et verrouillé.
  editing: ThreadRoutingRule | null
  onClose: () => void
  onSaved: (result: ThreadRoutingRule | StagedRoutingRule) => void
}

export function ProAddressFormModal({ open, domain, users, editing, onClose, onSaved }: ProAddressFormModalProps) {
  const [alias, setAlias] = useState('')
  const [mode, setMode] = useState<'member' | 'email'>('member')
  const [assignToId, setAssignToId] = useState('')
  const [assignToEmail, setAssignToEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setAlias(editing?.canal ?? '')
      setMode('member')
      setAssignToId(editing?.assignTo.id ?? users[0]?.id ?? '')
      setAssignToEmail('')
      setError('')
    }
  }, [open, editing, users])

  const canal = alias.trim().toLowerCase().split('@')[0]
  const canSubmit = canal.length > 0 && (mode === 'member' ? !!assignToId : !!assignToEmail.trim())

  const submit = async () => {
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      const body = mode === 'member' ? { assignToId } : { assignToEmail: assignToEmail.trim().toLowerCase() }
      const res = await apiFetch(`/thread-routing-rules/${encodeURIComponent(canal)}`, { method: 'PUT', body: JSON.stringify(body) })
      if (!res.ok) {
        setError(await parseError(res, "Impossible de créer cette adresse."))
        return
      }
      onSaved(await res.json())
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? `Réattribuer ${editing.canal}@${domain}` : 'Nouvelle adresse pro'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} loading={loading} disabled={!canSubmit}>{editing ? 'Réattribuer' : 'Créer'}</Button>
        </>
      }
    >
      <div className="flex items-end gap-1.5">
        <div className="flex-1">
          <Input label="Adresse" placeholder="contact" value={alias} onChange={e => setAlias(e.target.value)} autoFocus={!editing} disabled={!!editing} />
        </div>
        <span className="pb-2.5 text-sm text-muted-foreground font-mono whitespace-nowrap">@{domain}</span>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 my-3 rounded-md bg-muted">
        <button
          type="button"
          onClick={() => setMode('member')}
          className={`py-2 text-xs font-medium rounded-sm transition-colors ${mode === 'member' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          Un membre existant
        </button>
        <button
          type="button"
          onClick={() => setMode('email')}
          className={`py-2 text-xs font-medium rounded-sm transition-colors ${mode === 'email' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          Pas encore de compte
        </button>
      </div>

      {mode === 'member' ? (
        users.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun membre dans cette organisation pour l'instant.</p>
        ) : (
          <Select label="Attribuer à" value={assignToId} onChange={e => setAssignToId(e.target.value)}>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.nom} ({u.username})</option>
            ))}
          </Select>
        )
      ) : (
        <>
          <Input label="Email" type="email" placeholder="personne@exemple.com" value={assignToEmail} onChange={e => setAssignToEmail(e.target.value)} />
          <p className="text-xs text-muted-foreground/80 mt-1.5">
            Une invitation en attente doit déjà exister pour cet email (voir Invitations) — l'adresse sera active dès
            l'activation du compte.
          </p>
        </>
      )}

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </Modal>
  )
}
