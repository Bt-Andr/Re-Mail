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
  const [googleLoading, setGoogleLoading] = useState(false)

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

  // Se connecter directement via Google (comptes perso uniquement) : crée le compte à la
  // volée s'il n'existe pas encore et connecte le Gmail dans la foulée — voir
  // GoogleCallbackPage pour la suite du flux après le retour de Google.
  const continueWithGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      const returnTo = `${window.location.origin}/auth/google/callback`
      const res = await apiFetch(`/mailbox-connections/gmail/start-signin?returnTo=${encodeURIComponent(returnTo)}`)
      if (!res.ok) {
        setError(await parseError(res, 'Connexion Google indisponible.'))
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      setError(networkErrorMessage(err))
      setGoogleLoading(false)
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
        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button variant="secondary" onClick={() => void continueWithGoogle()} loading={googleLoading} className="w-full">
          Continuer avec Google
        </Button>
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
