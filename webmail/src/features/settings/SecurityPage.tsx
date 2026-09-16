import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function SecurityPage() {
  const navigate = useNavigate()
  const { logout } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (newPassword !== confirmation) return setError('Les nouveaux mots de passe ne correspondent pas.')
    setError('')
    setLoading(true)
    try {
      const response = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!response.ok) return setError(await parseError(response))
      logout()
      navigate('/login?passwordChanged=1', { replace: true })
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-lg font-semibold">Sécurité du compte</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">Changer votre mot de passe déconnecte toutes vos autres sessions.</p>
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-5">
        <Input label="Mot de passe actuel" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
        <Input label="Nouveau mot de passe" type="password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
        <Input label="Confirmer le nouveau mot de passe" type="password" minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" loading={loading}>Changer le mot de passe</Button>
      </form>
    </div>
  )
}
