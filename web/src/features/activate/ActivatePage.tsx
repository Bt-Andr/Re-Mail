import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { UploadFileStep } from './steps/UploadFileStep'
import { VerifyCodeStep } from './steps/VerifyCodeStep'
import { SetPasswordStep } from './steps/SetPasswordStep'

// Page publique, hors AuthGuard/AppShell — atteignable sans session. Flow linéaire
// en 3 étapes, pas besoin de sous-routes (pas de raison de lier directement l'étape 2/3).
export function ActivatePage() {
  const [fileToken, setFileToken] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState('')
  const [activationToken, setActivationToken] = useState<string | null>(null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground flex-shrink-0">
            <Mail size={14} strokeWidth={2.5} />
          </div>
          <h1 className="text-lg font-semibold">Activer mon compte</h1>
        </div>

        {!fileToken && (
          <UploadFileStep
            onResolved={(token, orgName) => {
              setFileToken(token)
              setOrganizationName(orgName)
            }}
          />
        )}

        {fileToken && !activationToken && (
          <VerifyCodeStep fileToken={fileToken} organizationName={organizationName} onVerified={setActivationToken} />
        )}

        {fileToken && activationToken && <SetPasswordStep fileToken={fileToken} activationToken={activationToken} />}

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Déjà activé ? <Link to="/login" className="text-foreground font-medium hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}