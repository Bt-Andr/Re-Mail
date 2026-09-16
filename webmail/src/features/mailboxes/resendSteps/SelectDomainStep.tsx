import { FormEvent, useCallback, useEffect, useState } from 'react'
import { apiFetch, networkErrorMessage, parseError } from '../../../lib/apiClient'
import { Select } from '../../../components/ui/Select'
import { Button } from '../../../components/ui/Button'
import { Callout } from '../../../components/ui/Callout'

export function SelectDomainStep({ verifiedDomains, onDone }: { verifiedDomains: string[] | null; onDone: () => void }) {
  const [domain, setDomain] = useState(verifiedDomains?.[0] ?? '')
  const [domains, setDomains] = useState<string[]>(verifiedDomains ?? [])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingDomains, setLoadingDomains] = useState(verifiedDomains === null)

  const refreshDomains = useCallback(async () => {
    setError('')
    setLoadingDomains(true)
    try {
      const res = await apiFetch('/organizations/me/resend/domains')
      if (!res.ok) {
        setError(await parseError(res, 'Impossible de relire les domaines Resend.'))
        setDomains([])
        return
      }
      const data = (await res.json()) as { verifiedDomains: string[] }
      setDomains(data.verifiedDomains)
      setDomain(current => (data.verifiedDomains.includes(current) ? current : (data.verifiedDomains[0] ?? '')))
    } catch (err) {
      setDomains([])
      setError(networkErrorMessage(err))
    } finally {
      setLoadingDomains(false)
    }
  }, [])

  useEffect(() => {
    if (verifiedDomains === null) void refreshDomains()
  }, [refreshDomains, verifiedDomains])

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

      {domains.length > 0 ? (
        <Select label="Domaine vérifié" value={domain} onChange={e => setDomain(e.target.value)} required>
          {domains.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
      ) : (
        <Callout icon={false}>
          Aucun domaine vérifié trouvé dans votre compte Resend. Vérifiez-en un dans le dashboard Resend, puis actualisez cette liste.
        </Callout>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={loading} disabled={!domain}>Continuer</Button>
        <Button type="button" variant="secondary" loading={loadingDomains} onClick={() => void refreshDomains()}>
          Actualiser les domaines
        </Button>
      </div>
    </form>
  )
}
