import { FormEvent, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { useOrganization } from '../../hooks/useOrganization'
import { ConnectResendStep } from './resendSteps/ConnectResendStep'
import { SelectDomainStep } from './resendSteps/SelectDomainStep'
import { DnsRecordsStep } from './resendSteps/DnsRecordsStep'
import { WebhookSecretStep } from './resendSteps/WebhookSecretStep'
import { WebhookTestStep } from './resendSteps/WebhookTestStep'
import { RoundTripTestStep } from './resendSteps/RoundTripTestStep'

// Réutilise telles quelles les étapes de l'onboarding (déjà autonomes : juste
// organization + onDone, aucune extraction nécessaire) dans un flux indépendant
// accessible depuis le picker "ajouter un compte", pas seulement au premier signup.
// Après le webhook, le flux crée aussi la première adresse utilisable : User.proEmail
// pour un compte personnel, MailRoute pour une équipe. Le wizard ne peut donc plus
// annoncer une connexion terminée alors que le composeur n'a encore aucun expéditeur.
export function ResendConnectModal({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const { organization, loading, refetch } = useOrganization()
  const [verifiedDomains, setVerifiedDomains] = useState<string[] | null>(null)
  const [dnsReady, setDnsReady] = useState(false)
  const [webhookTestDone, setWebhookTestDone] = useState(false)

  const close = () => {
    setVerifiedDomains(null)
    setDnsReady(false)
    setWebhookTestDone(false)
    onClose()
  }

  let step: 'connect' | 'domain' | 'dns' | 'webhook' | 'webhook-test' | 'address' | 'round-trip' | 'done' = 'connect'
  if (organization) {
    if (!organization.resendConnected) step = 'connect'
    else if (!organization.resendVerifiedDomain) step = 'domain'
    else if (!organization.webhookConfigured && !dnsReady) step = 'dns'
    else if (!organization.webhookConfigured) step = 'webhook'
    else if (!organization.setupStatus.webhookVerified && !webhookTestDone) step = 'webhook-test'
    else if (!organization.setupStatus.firstAddressConfigured) step = 'address'
    else if (!organization.setupStatus.roundTripVerified) step = 'round-trip'
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
      ) : step === 'dns' ? (
        <DnsRecordsStep onReady={() => setDnsReady(true)} />
      ) : step === 'webhook' ? (
        <WebhookSecretStep organization={organization} onDone={refetch} />
      ) : step === 'webhook-test' ? (
        <WebhookTestStep
          onVerified={() => {
            setWebhookTestDone(true)
            void refetch()
          }}
        />
      ) : step === 'address' ? (
        <FirstAddressStep
          domain={organization.resendVerifiedDomain!}
          isPersonal={organization.isPersonal}
          organizationName={organization.name}
          onDone={refetch}
        />
      ) : step === 'round-trip' ? (
        <RoundTripTestStep onVerified={refetch} />
      ) : (
        <div className="space-y-5 py-2">
          <div className="text-center">
            <CheckCircle2 className="mx-auto text-emerald-600 dark:text-emerald-400 mb-3" size={40} />
            <h2 className="text-base font-semibold text-foreground">Votre messagerie est opérationnelle</h2>
            <p className="mt-1 text-xs text-muted-foreground">Re-Mail peut maintenant envoyer et recevoir sur {organization.resendVerifiedDomain}.</p>
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
            {[
              `Domaine ${organization.resendVerifiedDomain} validé`,
              'Webhook entrant vérifié',
              'Première adresse créée',
              'Envoi et réception testés de bout en bout',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={() => {
              close()
              onConnected()
            }}
          >
            Ouvrir la boîte de réception
          </Button>
        </div>
      )}
    </Modal>
  )
}

// Un compte perso utilise directement User.proEmail. Une organisation d'équipe crée
// plutôt un MailRoute : l'adresse devient à la fois expéditeur autorisé et destination
// entrante, sans imposer un transfert vers une boîte personnelle.
function FirstAddressStep({
  domain,
  isPersonal,
  organizationName,
  onDone,
}: {
  domain: string
  isPersonal: boolean
  organizationName: string
  onDone: () => void | Promise<void>
}) {
  const { user } = useSession()
  const [localPart, setLocalPart] = useState(() => (isPersonal && user ? user.username : 'contact'))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const email = `${localPart.trim().toLowerCase()}@${domain}`
    setError('')
    setLoading(true)
    try {
      const res = isPersonal
        ? await apiFetch(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ proEmail: email }) })
        : await apiFetch('/mail-routes', {
            method: 'POST',
            body: JSON.stringify({ alias: email, personalEmail: '', displayName: organizationName }),
          })
      if (!res.ok) {
        setError(await parseError(res, 'Adresse invalide.'))
        return
      }
      await onDone()
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-1">6. Créer la première adresse</h2>
        <p className="text-xs text-muted-foreground">
          Choisissez l'adresse qui servira à envoyer et recevoir les premiers messages dans Re-Mail.
        </p>
      </div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input label="Nom de l'adresse" placeholder="contact" value={localPart} onChange={e => setLocalPart(e.target.value)} autoFocus required />
        </div>
        <span className="pb-2.5 text-sm text-muted-foreground">@{domain}</span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" loading={loading} disabled={!localPart.trim()}>Créer l'adresse</Button>
    </form>
  )
}
