import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, parseError, networkErrorMessage } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'

export function SignupPage() {
  const { login, connectOrganization, hasPersonalAccount } = useSession()
  const navigate = useNavigate()
  const [accountType, setAccountType] = useState<'pro' | 'perso'>('pro')
  const [form, setForm] = useState({ orgName: '', nom: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    // L'accès organisation ne doit jamais être la toute première identité d'un compte
    // (décision produit — plan "Découpler l'identité personnelle de l'accès
    // organisation", Phase 2) : une identité perso doit exister avant de créer une
    // entreprise. Ce formulaire n'est atteignable que sans aucun compte connecté
    // (GuestGuard), donc hasPersonalAccount est fiable ici sans re-vérification serveur.
    if (accountType === 'pro' && !hasPersonalAccount) {
      setError('Connectez d’abord une identité personnelle avant de créer une entreprise.')
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ ...form, accountType }) })
      if (!res.ok) {
        setError(await parseError(res, 'Impossible de créer votre espace.'))
        return
      }
      const data = await res.json()
      if (accountType === 'perso') login(data.token, data.user, data.organization)
      else connectOrganization(data.token, data.user, data.organization)
      navigate('/inbox')
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // Pour un nouveau compte perso, "se connecter avec Google" EST l'inscription — crée le
  // compte à la volée et connecte le Gmail dans la foulée (voir GoogleCallbackPage).
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
          <h1 className="text-lg font-semibold">Créer votre espace</h1>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 mb-5 rounded-md bg-muted">
          {(['pro', 'perso'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setAccountType(type)}
              className={`py-2 text-xs font-medium rounded-sm transition-colors ${
                accountType === type ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {type === 'pro' ? 'Équipe' : 'Perso — usage personnel'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          {accountType === 'pro' && (
            <Input label="Nom de l'organisation" value={form.orgName} onChange={set('orgName')} autoFocus required />
          )}
          <Input label="Votre nom" value={form.nom} onChange={set('nom')} autoFocus={accountType === 'perso'} required />
          <Input label="Nom d'utilisateur" value={form.username} onChange={set('username')} required />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
          <Input label="Mot de passe" type="password" value={form.password} onChange={set('password')} required />
          {error && (
            <p className="text-xs text-destructive">
              {error}{' '}
              {accountType === 'pro' && !hasPersonalAccount && (
                <Link to="/welcome" className="underline font-medium">Connecter mon identité personnelle</Link>
              )}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full">Créer mon espace</Button>
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
          Déjà un compte ? <Link to="/login" className="text-foreground font-medium hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
