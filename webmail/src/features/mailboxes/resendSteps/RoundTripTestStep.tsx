import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { apiFetch, networkErrorMessage, parseError } from '../../../lib/apiClient'
import { Button } from '../../../components/ui/Button'
import { Callout } from '../../../components/ui/Callout'
import { Spinner } from '../../../components/ui/Spinner'
import type { RoundTripTestStatus } from '../../../types/api'

export function RoundTripTestStep({ onVerified }: { onVerified: () => void }) {
  const [status, setStatus] = useState<RoundTripTestStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const response = await apiFetch('/organizations/me/resend/round-trip-test')
      if (!response.ok) {
        setError(await parseError(response, 'Impossible de vérifier le test aller-retour.'))
        return null
      }
      const next = (await response.json()) as RoundTripTestStatus
      setStatus(next)
      return next
    } catch (err) {
      setError(networkErrorMessage(err))
      return null
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!status?.started || status.received) return
    const handle = window.setInterval(() => void loadStatus(true), 5_000)
    return () => window.clearInterval(handle)
  }, [loadStatus, status?.received, status?.started])

  const sendChallenge = async (challenge: RoundTripTestStatus) => {
    if (!challenge.address || !challenge.subject) return false
    const response = await apiFetch('/emails/reply', {
      method: 'POST',
      body: JSON.stringify({
        to: challenge.address,
        fromEmail: challenge.address,
        subject: challenge.subject,
        message: challenge.message,
        mode: 'new',
      }),
    })
    if (!response.ok) {
      setError(await parseError(response, "L'email test n'a pas pu être envoyé."))
      return false
    }
    return true
  }

  const start = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch('/organizations/me/resend/round-trip-test/start', { method: 'POST' })
      if (!response.ok) {
        setError(await parseError(response, 'Impossible de démarrer le test.'))
        return
      }
      const challenge = (await response.json()) as RoundTripTestStatus
      setStatus(challenge)
      if (await sendChallenge(challenge)) await loadStatus(true)
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const retrySend = async () => {
    if (!status) return
    setLoading(true)
    setError('')
    try {
      if (await sendChallenge(status)) await loadStatus(true)
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
        <h2 className="text-sm font-semibold mb-1">7. Tester l'envoi et la réception</h2>
        <p className="text-xs text-muted-foreground">
          Re-Mail envoie un message à votre nouvelle adresse puis attend son retour par le webhook. Les deux sens sont ainsi vérifiés sans boîte externe.
        </p>
      </div>

      {!status?.started ? (
        <Button onClick={() => void start()} loading={loading}>Lancer le test aller-retour</Button>
      ) : status.received ? (
        <>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={18} />
            <p className="text-sm font-medium">Envoi et réception confirmés sur {status.address}.</p>
          </div>
          <Button onClick={onVerified}>Continuer</Button>
        </>
      ) : status.sent ? (
        <>
          <Callout icon={false}>Email envoyé depuis {status.address}. Réception en cours, cette étape s'actualise automatiquement.</Callout>
          <Button variant="secondary" onClick={() => void loadStatus()} loading={loading}>Vérifier maintenant</Button>
        </>
      ) : (
        <>
          <Callout icon={false}>Le test est prêt pour {status.address}, mais aucun envoi réussi n'a encore été enregistré.</Callout>
          <Button onClick={() => void retrySend()} loading={loading}>Réessayer l'envoi</Button>
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
