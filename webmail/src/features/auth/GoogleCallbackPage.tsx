import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { apiFetch, parseError, networkErrorMessage } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Spinner } from '../../components/ui/Spinner'

const GOOGLE_SIGNIN_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: 'Consentement Google annulé.',
  state_invalid: 'La demande de connexion a expiré, réessayez.',
  token_exchange_failed: 'La connexion à Google a échoué.',
  account_provisioning_failed: 'Connexion impossible avec ce compte Google. Réessayez dans quelques instants.',
  // L'appelant a déjà prouvé la possession de cette boîte (OAuth Google réussi) avant
  // que ce code n'apparaisse — révéler qu'un compte d'équipe existe déjà ne fuite rien à
  // un tiers non authentifié (voir gmailOAuth.ts). La boîte est déjà rattachée à ce
  // compte, prête dès la connexion par mot de passe.
  account_exists_use_password: 'Un compte d’équipe existe déjà avec cette adresse. Connectez-vous avec le nom d’utilisateur et le mot de passe de ce compte — votre boîte y est déjà rattachée.',
}

// Point d'atterrissage public (hors GuestGuard/AuthGuard, comme /activate) de la
// redirection finale de GET /api/mailbox-connections/gmail/callback (intent 'signin') —
// reçoit soit ?handoff=... (à échanger contre une vraie session), soit ?error=....
export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useSession()
  const [error, setError] = useState('')
  const exchanged = useRef(false)

  useEffect(() => {
    if (exchanged.current) return
    exchanged.current = true

    const errorCode = searchParams.get('error')
    if (errorCode) {
      setError(GOOGLE_SIGNIN_ERROR_MESSAGES[errorCode] ?? 'La connexion avec Google a échoué.')
      return
    }

    const handoff = searchParams.get('handoff')
    if (!handoff) {
      setError('La connexion avec Google a échoué.')
      return
    }

    void (async () => {
      try {
        const res = await apiFetch('/auth/google/exchange', { method: 'POST', body: JSON.stringify({ handoff }) })
        if (!res.ok) {
          setError(await parseError(res, 'Cette session de connexion a expiré, réessayez.'))
          return
        }
        const data = await res.json()
        login(data.token, data.user, data.organization)
        navigate('/inbox', { replace: true })
      } catch (err) {
        setError(networkErrorMessage(err))
      }
    })()
  }, [searchParams, login, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-lg shadow-sm border border-border p-8 text-center">
        {error ? (
          <>
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Link to="/login" className="text-sm text-foreground font-medium hover:underline">Retour à la connexion</Link>
          </>
        ) : (
          <>
            <Spinner />
            <p className="text-xs text-muted-foreground mt-4">Connexion en cours…</p>
          </>
        )}
      </div>
    </div>
  )
}
