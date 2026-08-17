import { FormEvent, useState } from 'react'
import { apiFetch, parseError } from '../../../lib/apiClient'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Button } from '../../../components/ui/Button'
import { Callout } from '../../../components/ui/Callout'

export function SelectDomainStep({ verifiedDomains, onDone }: { verifiedDomains: string[] | null; onDone: () => void }) {
  const [domain, setDomain] = useState(verifiedDomains?.[0] ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/organizations/me/resend/select-domain', { method: 'POST', body: JSON.stringify({ domain }) })
      if (!res.ok) {
        setError(await parseError(res, 'Impossible d\'enregistrer ce domaine.'))
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
        <h2 className="text-sm font-semibold mb-1">2. Choisir le domaine</h2>
        <p className="text-xs text-muted-foreground">Le domaine déjà vérifié dans votre compte Resend, utilisé pour envoyer/recevoir vos emails.</p>
      </div>

      <Callout icon={false}>
        Si ce domaine a déjà des emails ailleurs (Gmail, Outlook, un autre hébergeur...), la réception Resend entrera en conflit avec les enregistrements MX existants — un domaine ne peut avoir qu'un seul jeu de MX actif. Utilisez plutôt un sous-domaine dédié (ex. mail.votredomaine.com) pour ne pas perturber vos boîtes actuelles.
      </Callout>

      {verifiedDomains && verifiedDomains.length > 0 ? (
        <Select label="Domaine vérifié" value={domain} onChange={e => setDomain(e.target.value)} required>
          {verifiedDomains.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
      ) : (
        <>
          {verifiedDomains && verifiedDomains.length === 0 && (
            <Callout icon={false}>
              Aucun domaine vérifié trouvé dans votre compte Resend. Vérifiez-en un dans votre dashboard Resend, puis revenez ici.
            </Callout>
          )}
          <Input
            label="Nom de domaine"
            placeholder="mail.votredomaine.com"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            {verifiedDomains === null && 'Page rechargée : saisissez à nouveau le domaine déjà vérifié dans Resend.'}
          </p>
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" loading={loading} disabled={!domain.trim()}>Continuer</Button>
    </form>
  )
}
