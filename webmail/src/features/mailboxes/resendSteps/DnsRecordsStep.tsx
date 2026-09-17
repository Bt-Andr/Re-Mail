import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, networkErrorMessage, parseError } from '../../../lib/apiClient'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Callout } from '../../../components/ui/Callout'
import { CopyField } from '../../../components/ui/CopyField'
import { Spinner } from '../../../components/ui/Spinner'
import type { ResendDomainStatus } from '../../../types/api'

export function DnsRecordsStep({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState<ResendDomainStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const response = await apiFetch('/organizations/me/resend/domain-status')
      if (!response.ok) {
        setError(await parseError(response, 'Impossible de vérifier le domaine Resend.'))
        return
      }
      setStatus((await response.json()) as ResendDomainStatus)
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const receivingRecords = useMemo(
    () => status?.records.filter(record => record.record.toLowerCase().includes('receiving')) ?? [],
    [status]
  )

  if (loading && !status) return <Spinner />

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">3. Vérifier la réception DNS</h2>
        <p className="text-xs text-muted-foreground">
          Le domaine <strong>{status?.name}</strong> doit avoir la réception activée dans Resend et son enregistrement MX validé.
        </p>
      </div>

      {!status?.receivingEnabled && (
        <Callout icon={false}>
          Activez d’abord la capacité « Receiving » sur ce domaine dans Resend. Les enregistrements MX à ajouter apparaîtront ensuite ici.
        </Callout>
      )}

      {status?.receivingEnabled && receivingRecords.length === 0 && (
        <Callout icon={false}>
          Resend n’a renvoyé aucun enregistrement « Receiving MX ». Vérifiez la configuration du domaine dans Resend puis actualisez.
        </Callout>
      )}

      {receivingRecords.map(record => (
        <div key={`${record.type}-${record.name}-${record.value}`} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">{record.record} · {record.type}</p>
            <Badge color={record.status.toLowerCase() === 'verified' ? 'green' : 'amber'}>
              {record.status.toLowerCase() === 'verified' ? 'Vérifié' : 'À vérifier'}
            </Badge>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Nom / hôte</p>
            <CopyField value={record.name} />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Valeur{record.priority !== null ? ` · priorité ${record.priority}` : ''}</p>
            <CopyField value={record.value} />
          </div>
        </div>
      ))}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {status?.receivingReady ? (
          <Button onClick={onReady}>Continuer vers le webhook</Button>
        ) : (
          <Button onClick={() => void refresh()} loading={loading}>Actualiser la vérification</Button>
        )}
        <a
          href="https://resend.com/domains"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Ouvrir Resend
        </a>
      </div>
    </div>
  )
}
