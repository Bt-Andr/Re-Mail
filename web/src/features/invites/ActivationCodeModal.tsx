import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { apiFetch, parseError } from '../../lib/apiClient'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { CopyField } from '../../components/ui/CopyField'
import { Spinner } from '../../components/ui/Spinner'
import type { UserInvite } from '../../types/api'

export function ActivationCodeModal({ invite, onClose }: { invite: UserInvite | null; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!invite) {
      setCode(null)
      setError('')
      return
    }
    setLoading(true)
    apiFetch(`/user-invites/${invite.id}/activation-code`, { method: 'POST' })
      .then(async res => {
        if (!res.ok) {
          setError(await parseError(res, 'Impossible de générer un code.'))
          return
        }
        const data = await res.json()
        setCode(data.code)
        setExpiresAt(data.expiresAt)
      })
      .finally(() => setLoading(false))
  }, [invite])

  if (!invite) return null

  return (
    <Modal open title={`Code d'activation — ${invite.username}`} onClose={onClose} footer={<Button onClick={onClose}>Fermer</Button>}>
      {loading && <Spinner label="Génération du code…" />}
      {!loading && error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && code && (
        <>
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Ce code ne sera plus jamais affiché. Communiquez-le à {invite.nom} par un canal séparé du fichier d'activation
              (ex. téléphone), pas dans le même message.
            </p>
          </div>
          <CopyField value={code} large />
          {expiresAt && <p className="text-xs text-muted-foreground">Expire {new Date(expiresAt).toLocaleTimeString('fr-FR')}</p>}
        </>
      )}
    </Modal>
  )
}
