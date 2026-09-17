import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../../lib/apiClient'
import { Button } from '../../../components/ui/Button'
import { Callout } from '../../../components/ui/Callout'
import { CopyField } from '../../../components/ui/CopyField'
import { Spinner } from '../../../components/ui/Spinner'
import type { WebhookTestStatus } from '../../../types/api'

export function WebhookTestStep({ onVerified }: { onVerified: () => void }) {
  const [status, setStatus] = useState<WebhookTestStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const response = await apiFetch('/organizations/me/resend/webhook-test')
      if (!response.ok) {
        setError(await parseError(response, 'Impossible de vérifier le webhook.'))
        return
      }
      setStatus((await response.json()) as WebhookTestStatus)
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!status?.started || status.verified) return
    const handle = window.setInterval(() => void loadStatus(true), 5_000)
    return () => window.clearInterval(handle)
  }, [loadStatus, status?.started, status?.verified])

  const start = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch('/organizations/me/resend/webhook-test/start', { method: 'POST' })
      if (!response.ok) {
        setError(await parseError(response, 'Impossible de démarrer le test.'))
        return
      }
      setStatus((await response.json()) as WebhookTestStatus)
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (loading && !status) return <Spinner />

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">5. Tester le webhook entrant</h2>
        <p className="text-xs text-muted-foreground">
          Ce test attend un véritable email reçu et signé par Resend. Un simple secret enregistré ne suffit pas.
        </p>
      </div>

      {!status?.started ? (
        <Button onClick={() => void start()} loading={loading}>Générer l’adresse de test</Button>
      ) : status.verified ? (
        <>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={18} />
            <p className="text-sm font-medium">Webhook vérifié par une réception réelle.</p>
          </div>
          <Button onClick={onVerified}>Continuer</Button>
        </>
      ) : (
        <>
          <Callout icon={false}>
            Envoyez maintenant un email depuis une adresse externe vers l’adresse unique ci-dessous. La vérification s’actualise automatiquement.
          </Callout>
          {status.testAddress && <CopyField value={status.testAddress} />}
          <Button variant="secondary" onClick={() => void loadStatus()} loading={loading}>Vérifier maintenant</Button>
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
