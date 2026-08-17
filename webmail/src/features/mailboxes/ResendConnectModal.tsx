import { FormEvent, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { apiFetch, parseError } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { useOrganization } from '../../hooks/useOrganization'
import { ConnectResendStep } from './resendSteps/ConnectResendStep'
import { SelectDomainStep } from './resendSteps/SelectDomainStep'
import { WebhookSecretStep } from './resendSteps/WebhookSecretStep'

// Réutilise telles quelles les étapes de l'onboarding (déjà autonomes : juste
// organization + onDone, aucune extraction nécessaire) dans un flux indépendant
// accessible depuis le picker "ajouter un compte", pas seulement au premier signup.
// Pas d'étape route ici (réglage d'équipe, configurable ensuite depuis Paramètres) —
// mais une étape "sender" est ajoutée pour les comptes perso (isPersonal) juste après
// le webhook : un utilisateur perso qui connecte Resend lui-même n'a pas d'admin pour
// lui régler son adresse d'expédition, contrairement à un membre d'une org d'équipe.
export function ResendConnectModal({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const { organization, loading, refetch } = useOrganization()
  const [verifiedDomains, setVerifiedDomains] = useState<string[] | null>(null)
  const [senderDone, setSenderDone] = useState(false)

  const close = () => {
    setVerifiedDomains(null)
    setSenderDone(false)
    onClose()
  }

  let step: 'connect' | 'domain' | 'webhook' | 'sender' | 'done' = 'connect'
  if (organization) {
    if (!organization.resendConnected) step = 'connect'
    else if (!organization.resendVerifiedDomain) step = 'domain'
    else if (!organization.webhookConfigured) step = 'webhook'
    else if (organization.isPersonal && !senderDone) step = 'sender'
    else step = 'done'
  }

  return (
    <Modal open={open} title="Connecter Resend" onClose={close}>
      {loading || !organization ? (
        <Spinner />
      ) : step === 'connect' ? (
        <ConnectResendStep
          onDone={domains => {
            setVerifiedDomains(domains)
            void refetch()
          }}
        />
      ) : step === 'domain' ? (
        <SelectDomainStep verifiedDomains={verifiedDomains} onDone={refetch} />
      ) : step === 'webhook' ? (
        <WebhookSecretStep organization={organization} onDone={refetch} />
      ) : step === 'sender' ? (
        <SenderStep domain={organization.resendVerifiedDomain!} onDone={() => setSenderDone(true)} />
      ) : (
        <div className="text-center py-6">
          <CheckCircle2 className="mx-auto text-emerald-600 dark:text-emerald-400 mb-3" size={40} />
          <p className="text-sm font-medium text-foreground mb-4">Resend connecté.</p>
          <Button
            onClick={() => {
              close()
              onConnected()
            }}
          >
            Terminer
          </Button>
        </div>
      )}
    </Modal>
  )
}

// Portée depuis l'ex-PersonalSenderStep (onboarding). Perso : pas de notion d'alias
// d'équipe — on pose directement User.proEmail, le seul champ que getAllowedSenders
// traite comme expéditeur par défaut indépendamment de tout MailRoute
// (src/helpers/senders.ts). Réutilise PUT /users/:id (habituellement un outil d'admin
// d'équipe) : un compte perso est toujours OWNER de sa propre org invisible, donc déjà
// autorisé à modifier son propre utilisateur via cette route sans rien ajouter côté backend.
function SenderStep({ domain, onDone }: { domain: string; onDone: () => void }) {
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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-1">Votre adresse</h2>
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
