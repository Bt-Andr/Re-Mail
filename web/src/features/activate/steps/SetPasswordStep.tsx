import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, parseError } from '../../../lib/apiClient'
import { useSession } from '../../../context/SessionContext'
import { Input } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'

interface SetPasswordStepProps {
  fileToken: string
  activationToken: string
}

export function SetPasswordStep({ fileToken, activationToken }: SetPasswordStepProps) {
  const { login } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('8 caractères minimum.')
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas.')

    setLoading(true)
    try {
      const res = await apiFetch('/public/user-invites/activate', {
        method: 'POST',
        body: JSON.stringify({ fileToken, activationToken, password }),
      })
      if (!res.ok) {
        setError(await parseError(res, "Impossible d'activer le compte. Recommencez depuis l'étape du code."))
        return
      }
      const data = await res.json()
      // Réponse identique à un login classique — connecte directement l'utilisateur.
      login(data.token, data.user)
      navigate('/inbox')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-1">3. Créer votre mot de passe</h2>
      </div>
      <Input label="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} autoFocus required />
      <Input label="Confirmer le mot de passe" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" loading={loading} className="w-full">Activer mon compte</Button>
    </form>
  )
}
