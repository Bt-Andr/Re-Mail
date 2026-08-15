import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useOrganization } from '../../hooks/useOrganization'
import { ConnectResendStep } from '../onboarding/steps/ConnectResendStep'
import { SelectDomainStep } from '../onboarding/steps/SelectDomainStep'
import { WebhookSecretStep } from '../onboarding/steps/WebhookSecretStep'

// Réutilise telles quelles les étapes de l'onboarding (déjà autonomes : juste
// organization + onDone, aucune extraction nécessaire) dans un flux indépendant
// accessible depuis le picker "ajouter un compte", pas seulement au premier signup.
// S'arrête après le webhook, contrairement à OnboardingWizard : pas d'étape
// sender/route ici — ce sont des réglages d'expéditeur/équipe configurables ensuite
// depuis Paramètres, pas un prérequis pour que la boîte Resend fonctionne.
export function ResendConnectModal({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const { organization, loading, refetch } = useOrganization()
  const [verifiedDomains, setVerifiedDomains] = useState<string[] | null>(null)

  const close = () => {
    setVerifiedDomains(null)
    onClose()
  }

  let step: 'connect' | 'domain' | 'webhook' | 'done' = 'connect'
  if (organization) {
    if (!organization.resendConnected) step = 'connect'
    else if (!organization.resendVerifiedDomain) step = 'domain'
    else if (!organization.webhookConfigured) step = 'webhook'
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
