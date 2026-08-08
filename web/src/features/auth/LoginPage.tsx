import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, parseError, networkErrorMessage } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'

export function LoginPage() {
  const { login } = useSession()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      if (!res.ok) {
        setError(await parseError(res, 'Identifiants incorrects.'))
        return
      }
      const data = await res.json()
      login(data.token, data.user)
      navigate('/inbox')
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <img src="/web-app-manifest-192x192.png" alt="Re-Mail" className="w-7 h-7 rounded-md flex-shrink-0" />
          <h1 className="text-lg font-semibold">Connexion</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nom d'utilisateur" value={username} onChange={e => setUsername(e.target.value)} autoFocus required />
          <Input label="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Se connecter</Button>
        </form>
        <p className="text-xs text-muted-foreground mt-6 text-center">
          Pas encore d'organisation ? <Link to="/signup" className="text-foreground font-medium hover:underline">Créer un espace</Link>
        </p>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Invité par un administrateur ? <Link to="/activate" className="text-foreground font-medium hover:underline">Activer mon compte</Link>
        </p>
      </div>
    </div>
  )
}
