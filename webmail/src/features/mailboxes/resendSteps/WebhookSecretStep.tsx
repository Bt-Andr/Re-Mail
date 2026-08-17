import { FormEvent, useState } from 'react'
import { apiFetch, parseError } from '../../../lib/apiClient'
import { Input } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { CopyField } from '../../../components/ui/CopyField'
import type { OrganizationStatus } from '../../../types/api'

export function WebhookSecretStep({ organization, onDone }: { organization: OrganizationStatus; onDone: () => void }) {
  const [webhookSecret, setWebhookSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/organizations/me/resend/webhook-secret', { method: 'POST', body: JSON.stringify({ webhookSecret }) })
      if (!res.ok) {
        setError(await parseError(res, 'Secret invalide.'))
        return
      }
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 bg-card border border-border rounded-lg p-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">3. Configurer le webhook entrant</h2>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Dans votre dashboard Resend → Webhooks → Add Webhook, collez l'URL ci-dessous et cochez l'événement "email.received".</li>
          <li>Une fois le webhook créé, Resend affiche un secret de signature ("Signing Secret") sur sa page de détail — collez-le dans le champ ci-dessous.</li>
        </ol>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">URL du webhook</p>
        <CopyField value={organization.webhookUrl} />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Input label="Secret de signature Resend" placeholder="whsec_..." value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} required />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" loading={loading} disabled={!webhookSecret.trim()}>Valider</Button>
      </form>
    </div>
  )
}
