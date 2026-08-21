import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Users, KeyRound } from 'lucide-react'
import { apiFetch, parseError, networkErrorMessage } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { CreateEnterpriseFlow } from './CreateEnterpriseFlow'

type AddMode = 'menu' | 'login'

// "Ajouter un compte" depuis l'app déjà connectée — toujours une connexion ADDITIVE
// (une identité personnelle existe forcément déjà pour arriver ici, voir
// IdentitySwitcher). Pas de gate "identité perso d'abord" nécessaire ici, contrairement
// à WelcomePage/ActivatePage.
export function AddAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, connectOrganization } = useSession()
  const [mode, setMode] = useState<AddMode>('menu')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const close = () => {
    setMode('menu')
    setForm({ username: '', password: '' })
    setError('')
    onClose()
  }

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(form) })
      if (!res.ok) {
        setError(await parseError(res, 'Identifiants incorrects.'))
        return
      }
      const data = await res.json()
      if (data.organization.isPersonal) login(data.token, data.user, data.organization)
      else connectOrganization(data.token, data.user, data.organization)
      close()
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (createOpen) {
    return (
      <CreateEnterpriseFlow
        open
        onClose={() => {
          setCreateOpen(false)
          close()
        }}
      />
    )
  }

  return (
    <Modal open={open} title="Ajouter un compte" onClose={close}>
      {mode === 'menu' && (
        <div className="-mx-6 divide-y divide-border border-t border-b border-border">
          <button
            type="button"
            onClick={() => setMode('login')}
            className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-accent transition-colors"
          >
            <KeyRound size={20} className="text-muted-foreground" />
            <span className="flex-1 text-sm">Se connecter à une organisation</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-accent transition-colors"
          >
            <Building2 size={20} className="text-muted-foreground" />
            <span className="flex-1 text-sm">Créer une entreprise</span>
          </button>
          <Link
            to="/activate"
            onClick={close}
            className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-accent transition-colors"
          >
            <Users size={20} className="text-muted-foreground" />
            <span className="flex-1 text-sm">Rejoindre une entreprise</span>
          </Link>
        </div>
      )}

      {mode === 'login' && (
        <form onSubmit={submitLogin} className="space-y-4">
          <Input
            label="Nom d'utilisateur"
            value={form.username}
            onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
            autoFocus
            required
          />
          <Input
            label="Mot de passe"
            type="password"
            value={form.password}
            onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
            required
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Se connecter</Button>
        </form>
      )}
    </Modal>
  )
}
