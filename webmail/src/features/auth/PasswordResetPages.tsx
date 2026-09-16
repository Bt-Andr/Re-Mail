import { FormEvent, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <img src="/web-app-manifest-192x192.png" alt="Re-Mail" className="w-7 h-7 rounded-md" />
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await apiFetch('/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim() }),
      })
      if (!response.ok) return setError(await parseError(response))
      setSent(true)
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Mot de passe oublié">
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Si ce compte existe, un lien valable 30 minutes a été envoyé à son adresse email.</p>
          <Link to="/login" className="block text-center text-sm font-medium hover:underline">Retour à la connexion</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">Saisissez votre nom d’utilisateur. La réponse reste identique pour tous les comptes.</p>
          <Input label="Nom d'utilisateur" value={username} onChange={event => setUsername(event.target.value)} autoFocus required />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Envoyer le lien</Button>
          <Link to="/login" className="block text-center text-xs text-muted-foreground hover:underline">Annuler</Link>
        </form>
      )}
    </AuthCard>
  )
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== confirmation) return setError('Les mots de passe ne correspondent pas.')
    setError('')
    setLoading(true)
    try {
      const response = await apiFetch('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      })
      if (!response.ok) return setError(await parseError(response))
      setDone(true)
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Nouveau mot de passe">
      {!token ? (
        <p className="text-sm text-destructive">Ce lien est incomplet. Demandez un nouveau lien de réinitialisation.</p>
      ) : done ? (
        <div className="space-y-4">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Votre mot de passe a été mis à jour. Toutes les anciennes sessions ont été révoquées.</p>
          <Link to="/login?passwordChanged=1" className="block text-center text-sm font-medium hover:underline">Se connecter</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nouveau mot de passe" type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required autoFocus />
          <Input label="Confirmer le mot de passe" type="password" minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Mettre à jour</Button>
        </form>
      )}
    </AuthCard>
  )
}
