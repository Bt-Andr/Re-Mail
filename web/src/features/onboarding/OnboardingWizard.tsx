import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useOrganization } from '../../hooks/useOrganization'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { ConnectResendStep } from './steps/ConnectResendStep'
import { SelectDomainStep } from './steps/SelectDomainStep'
import { WebhookSecretStep } from './steps/WebhookSecretStep'
import { FirstMailRouteStep } from './steps/FirstMailRouteStep'

// L'étape courante se déduit de l'état de l'organisation (GET /organizations/me),
// donc un rechargement en cours de route reprend automatiquement au bon endroit.
export function OnboardingWizard() {
  const { organization, loading, refetch } = useOrganization()
  const navigate = useNavigate()
  // Renvoyé par l'étape "connect" (POST /resend/connect) — pas persisté côté
  // serveur, donc perdu si la page est rechargée entre les étapes 1 et 2 ;
  // SelectDomainStep gère ce cas avec une saisie manuelle de secours.
  const [verifiedDomains, setVerifiedDomains] = useState<string[] | null>(null)

  if (loading || !organization) return <Spinner label="Chargement de la configuration…" />

  let step: 'connect' | 'domain' | 'webhook' | 'route' | 'done'
  if (!organization.resendConnected) step = 'connect'
  else if (!organization.resendVerifiedDomain) step = 'domain'
  else if (!organization.webhookConfigured) step = 'webhook'
  else if (organization.mailRoutesCount === 0) step = 'route'
  else step = 'done'

  return (
    <div className="min-h-screen bg-background px-4 py-16">
    <div className="max-w-lg mx-auto">
      <h1 className="text-lg font-semibold mb-1">Connecter Resend</h1>
      <p className="text-sm text-muted-foreground mb-6">Configurez votre compte Resend pour commencer à recevoir et envoyer des emails.</p>

      <ol className="flex items-center gap-2 mb-8 text-xs text-muted-foreground">
        {(['connect', 'domain', 'webhook', 'route'] as const).map((s, i) => (
          <li key={s} className={`flex items-center gap-1 ${step === s ? 'text-foreground font-medium' : ''}`}>
            {i > 0 && <span className="mx-1">→</span>}
            {i + 1}
          </li>
        ))}
      </ol>

      {step === 'connect' && (
        <ConnectResendStep
          onDone={domains => {
            setVerifiedDomains(domains)
            void refetch()
          }}
        />
      )}
      {step === 'domain' && <SelectDomainStep verifiedDomains={verifiedDomains} onDone={refetch} />}
      {step === 'webhook' && <WebhookSecretStep organization={organization} onDone={refetch} />}
      {step === 'route' && <FirstMailRouteStep onDone={refetch} onSkip={() => navigate('/inbox')} />}
      {step === 'done' && (
        <div className="text-center py-10">
          <CheckCircle2 className="mx-auto text-emerald-600 dark:text-emerald-400 mb-3" size={40} />
          <p className="text-sm font-medium text-foreground mb-4">Configuration terminée !</p>
          <Button onClick={() => navigate('/inbox')}>Aller à la boîte de réception</Button>
        </div>
      )}
    </div>
    </div>
  )
}
