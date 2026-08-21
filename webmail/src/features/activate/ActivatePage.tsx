import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, parseError, networkErrorMessage } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { UploadFileStep } from './steps/UploadFileStep'
import { VerifyCodeStep } from './steps/VerifyCodeStep'
import { SetPasswordStep } from './steps/SetPasswordStep'

// Page publique, hors AuthGuard/AppShell — atteignable sans session. Flow linéaire
// en 3 étapes, pas besoin de sous-routes (pas de raison de lier directement l'étape 2/3).
//
// `?token=` (lien reçu par email, voir routes/userInvites.ts::sendInviteEmail) permet
// de sauter directement à l'étape du code sans passer par l'upload manuel du fichier.
export function ActivatePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { hasPersonalAccount, setPendingOrgIntent } = useSession()
  const linkToken = searchParams.get('token')

  const [fileToken, setFileToken] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState('')
  const [activationToken, setActivationToken] = useState<string | null>(null)
  const [resolvingLink, setResolvingLink] = useState(!!linkToken)
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    if (!linkToken) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch(`/public/user-invites/resolve-by-token?token=${encodeURIComponent(linkToken)}`)
        if (cancelled) return
        if (!res.ok) {
          setLinkError(await parseError(res, "Ce lien d'activation n'est plus valide."))
          return
        }
        const data = await res.json()
        setFileToken(data.fileToken)
        setOrganizationName(data.organizationName)
      } catch (err) {
        if (!cancelled) setLinkError(networkErrorMessage(err))
      } finally {
        if (!cancelled) setResolvingLink(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [linkToken])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <img src="/web-app-manifest-192x192.png" alt="Re-Mail" className="w-7 h-7 rounded-md flex-shrink-0" />
          <h1 className="text-lg font-semibold">Activer mon compte</h1>
        </div>

        {resolvingLink && <Spinner />}

        {!resolvingLink && linkError && <p className="text-xs text-destructive mb-4">{linkError}</p>}

        {!resolvingLink && !fileToken && (
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

        {fileToken && activationToken && !hasPersonalAccount && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">3. Connectez d'abord votre identité personnelle</h2>
            <p className="text-xs text-muted-foreground">
              Rejoindre une entreprise sur Re-Mail nécessite d'abord une identité personnelle (Google ou une autre
              boîte mail) — l'accès à l'organisation vient s'ajouter à celle-ci, il ne la remplace jamais.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setPendingOrgIntent('join-enterprise')
                // Préserve ?token= (lien d'invitation par email) pour que la reprise
                // depuis WelcomePage retombe sur la résolution automatique plutôt que de
                // forcer un ré-upload manuel du fichier.
                if (linkToken) sessionStorage.setItem('rmm_activate_return_query', window.location.search)
                navigate('/welcome')
              }}
            >
              Connecter mon identité personnelle
            </Button>
          </div>
        )}

        {fileToken && activationToken && hasPersonalAccount && (
          <SetPasswordStep fileToken={fileToken} activationToken={activationToken} />
        )}

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Déjà activé ? <Link to="/login" className="text-foreground font-medium hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
