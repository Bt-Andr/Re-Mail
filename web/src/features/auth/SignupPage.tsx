import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { apiFetch, parseError } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'

export function SignupPage() {
  const { login } = useSession()
  const navigate = useNavigate()
  const [form, setForm] = useState({ orgName: '', nom: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(form) })
      if (!res.ok) {
        setError(await parseError(res, 'Impossible de créer votre espace.'))
        return
      }
      const data = await res.json()
      login(data.token, data.user, data.organization)
      navigate('/onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground flex-shrink-0">
            <Mail size={14} strokeWidth={2.5} />
          </div>
          <h1 className="text-lg font-semibold">Créer votre espace</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nom de l'organisation" value={form.orgName} onChange={set('orgName')} autoFocus required />
          <Input label="Votre nom" value={form.nom} onChange={set('nom')} required />
          <Input label="Nom d'utilisateur" value={form.username} onChange={set('username')} required />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
          <Input label="Mot de passe" type="password" value={form.password} onChange={set('password')} required />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Créer mon espace</Button>
        </form>
        <p className="text-xs text-muted-foreground mt-6 text-center">
          Déjà un compte ? <Link to="/login" className="text-foreground font-medium hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
