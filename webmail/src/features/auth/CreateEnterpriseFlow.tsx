import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, parseError, networkErrorMessage } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { ResendConnectModal } from '../mailboxes/ResendConnectModal'

// "Créer une entreprise" depuis l'écran d'accueil : symétrique à l'inscription "pro" du
// formulaire classique (SignupPage), juste réduite à ce cas précis — puis enchaîne
// directement sur ResendConnectModal (réutilisé tel quel, aucune étape réécrite) une
// fois la session établie, plutôt que d'atterrir en boîte de réception avant d'avoir
// rien connecté.
export function CreateEnterpriseFlow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { connectOrganization } = useSession()
  const navigate = useNavigate()
  const [signedUp, setSignedUp] = useState(false)
  const [form, setForm] = useState({ orgName: '', nom: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const close = () => {
    setSignedUp(false)
    setForm({ orgName: '', nom: '', username: '', email: '', password: '' })
    setError('')
    onClose()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ ...form, accountType: 'pro' }) })
      if (!res.ok) {
        setError(await parseError(res, 'Impossible de créer votre entreprise.'))
        return
      }
      const data = await res.json()
      // Connexion ADDITIVE : ne remplace jamais l'identité personnelle déjà en place
      // (WelcomePage n'ouvre ce flow qu'une fois hasPersonalAccount vrai — voir plan
      // "Découpler l'identité personnelle de l'accès organisation", Phase 2).
      connectOrganization(data.token, data.user, data.organization)
      setSignedUp(true)
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (signedUp) {
    return (
      <ResendConnectModal
        open
        onClose={close}
        onConnected={() => {
          close()
          navigate('/inbox')
        }}
      />
    )
  }

  return (
    <Modal open={open} title="Créer votre entreprise" onClose={close}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nom de l'organisation" value={form.orgName} onChange={set('orgName')} autoFocus required />
        <Input label="Votre nom" value={form.nom} onChange={set('nom')} required />
        <Input label="Nom d'utilisateur" value={form.username} onChange={set('username')} required />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
        <Input label="Mot de passe" type="password" value={form.password} onChange={set('password')} required />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">Continuer</Button>
      </form>
    </Modal>
  )
}
