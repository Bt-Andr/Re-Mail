import { FormEvent, useState } from 'react'
import { apiFetch, parseError } from '../../../lib/apiClient'
import { useSession } from '../../../context/SessionContext'
import { Input } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'

// Perso : pas de notion d'alias d'équipe (voir FirstMailRouteStep, sauté en perso) —
// on pose directement User.proEmail, le seul champ que getAllowedSenders traite comme
// expéditeur par défaut indépendamment de tout MailRoute (src/helpers/senders.ts).
// Réutilise PUT /users/:id (habituellement un outil d'admin d'équipe) : un compte perso
// est toujours OWNER de sa propre org invisible, donc déjà autorisé à modifier son propre
// utilisateur via cette route sans rien ajouter côté backend.
export function PersonalSenderStep({ domain, onDone }: { domain: string; onDone: () => void }) {
  const { user } = useSession()
  const [email, setEmail] = useState(() => (user ? `${user.username}@${domain}` : ''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ proEmail: email.trim() }) })
      if (!res.ok) {
        setError(await parseError(res, 'Adresse invalide.'))
        return
      }
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 bg-card border border-border rounded-lg p-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">4. Votre adresse</h2>
        <p className="text-xs text-muted-foreground">
          Toutes les adresses @{domain} reçoivent déjà leurs emails dans votre boîte. Choisissez celle que vous
          utiliserez pour envoyer des messages depuis le composeur.
        </p>
      </div>
      <Input label="Adresse" placeholder={`vous@${domain}`} type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" loading={loading} disabled={!email.trim()}>Continuer</Button>
    </form>
  )
}
