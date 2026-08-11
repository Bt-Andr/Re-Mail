import { useEffect, useState } from 'react'
import { apiFetch, parseError } from '../../lib/apiClient'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'

const EMPTY = {
  email: '',
  imapHost: '',
  imapPort: '993',
  imapSecure: true,
  smtpHost: '',
  smtpPort: '465',
  smtpSecure: true,
  password: '',
}

interface MailboxConnectionFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

// Pas d'edit ici (contrairement à MailRouteFormModal) : changer les identifiants d'une
// boîte externe, c'est en reconnecter une — plus simple de supprimer et recréer.
export function MailboxConnectionFormModal({ open, onClose, onSaved }: MailboxConnectionFormModalProps) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setError('')
    }
  }, [open])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const canSubmit = form.email.trim() && form.imapHost.trim() && form.smtpHost.trim() && form.password

  const submit = async () => {
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/mailbox-connections', {
        method: 'POST',
        body: JSON.stringify({ ...form, imapPort: Number(form.imapPort), smtpPort: Number(form.smtpPort) }),
      })
      if (!res.ok) {
        setError(await parseError(res, 'Connexion impossible.'))
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
      title="Connecter une boîte mail"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} loading={loading} disabled={!canSubmit}>Connecter</Button>
        </>
      }
    >
      <p className="text-xs text-muted-foreground">
        Fonctionne avec Gmail, Outlook et la plupart des fournisseurs (identifiants IMAP/SMTP classiques).
        Pour Gmail, utilisez un <span className="font-medium">mot de passe d'application</span> plutôt que votre mot de passe habituel.
      </p>
      <Input label="Adresse email" type="email" placeholder="vous@exemple.com" value={form.email} onChange={set('email')} autoFocus />
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input label="Serveur IMAP (réception)" placeholder="imap.exemple.com" value={form.imapHost} onChange={set('imapHost')} />
        </div>
        <Input label="Port" type="number" value={form.imapPort} onChange={set('imapPort')} />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={form.imapSecure} onChange={set('imapSecure')} />
        Connexion IMAP sécurisée (TLS)
      </label>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input label="Serveur SMTP (envoi)" placeholder="smtp.exemple.com" value={form.smtpHost} onChange={set('smtpHost')} />
        </div>
        <Input label="Port" type="number" value={form.smtpPort} onChange={set('smtpPort')} />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={form.smtpSecure} onChange={set('smtpSecure')} />
        Connexion SMTP sécurisée (TLS)
      </label>
      <Input label="Mot de passe" type="password" value={form.password} onChange={set('password')} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </Modal>
  )
}
