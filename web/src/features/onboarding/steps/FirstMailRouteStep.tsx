import { FormEvent, useState } from 'react'
import { apiFetch, parseError } from '../../../lib/apiClient'
import { Input } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'

export function FirstMailRouteStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [alias, setAlias] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/mail-routes', { method: 'POST', body: JSON.stringify({ alias, personalEmail }) })
      if (!res.ok) {
        setError(await parseError(res, 'Impossible de créer cette route.'))
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
        <h2 className="text-sm font-semibold mb-1">4. Créer votre première adresse</h2>
        <p className="text-xs text-muted-foreground">Une adresse @votredomaine.com (ex. contact@...) qui recevra les emails et pourra servir à répondre.</p>
      </div>
      <Input label="Adresse" placeholder="contact@votredomaine.com" value={alias} onChange={e => setAlias(e.target.value)} required />
      <Input label="Transférer les notifications vers" placeholder="vous@gmail.com" type="email" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} required />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" loading={loading} disabled={!alias.trim() || !personalEmail.trim()}>Créer</Button>
        <Button type="button" variant="ghost" onClick={onSkip}>Plus tard</Button>
      </div>
    </form>
  )
}
