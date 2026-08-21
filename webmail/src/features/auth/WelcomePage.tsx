import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Building2, Users } from 'lucide-react'
import { apiFetch, parseError, networkErrorMessage } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { MailboxConnectionFormModal, MAILBOX_PRESETS } from '../mailboxes/MailboxConnectionFormModal'
import { BASE_PROVIDERS, type BaseMailboxProvider } from '../mailboxes/providerList'
import { CreateEnterpriseFlow } from './CreateEnterpriseFlow'

type WelcomeProvider = BaseMailboxProvider | 'create-enterprise' | 'join-enterprise'

// Écran d'accueil non connecté : choisir un service de messagerie crée le compte ET
// connecte la première boîte en une seule étape (comme "Continuer avec Google" le
// fait déjà) — Re-Mail est un client mail générique, pas un formulaire d'inscription
// suivi d'un picker séparé. Le formulaire classique (nom d'utilisateur/mot de passe)
// reste accessible via le lien discret en bas, inchangé (LoginPage).
const ENTRIES: { id: WelcomeProvider; label: string; icon: JSX.Element }[] = [
  ...BASE_PROVIDERS.filter(p => p.id !== 'other'),
  { id: 'create-enterprise', label: 'Créer une entreprise', icon: <Building2 size={20} className="text-muted-foreground" /> },
  { id: 'join-enterprise', label: 'Rejoindre une entreprise', icon: <Users size={20} className="text-muted-foreground" /> },
  ...BASE_PROVIDERS.filter(p => p.id === 'other'),
]

export function WelcomePage() {
  const navigate = useNavigate()
  const { hasPersonalAccount, pendingOrgIntent: pendingIntent, setPendingOrgIntent: setPendingIntent } = useSession()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formPreset, setFormPreset] = useState<Partial<(typeof MAILBOX_PRESETS)[string]> | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)

  // Reprend l'intention en attente dès qu'une identité personnelle vient d'être
  // connectée (IMAP ici même, sans navigation ; ou Google via le retour depuis
  // GoogleCallbackPage, qui renvoie ici précisément pour laisser cet effet reprendre la
  // main). L'intention vit dans SessionContext (pas un état local) : GuestGuard en a
  // aussi besoin pour ne pas rediriger vers /inbox avant la reprise ci-dessous.
  useEffect(() => {
    if (!pendingIntent || !hasPersonalAccount) return
    setFormOpen(false)
    if (pendingIntent === 'create-enterprise') {
      // Ne PAS effacer pendingIntent ici : tant que la modale reste ouverte sur cette
      // même page /welcome, GuestGuard doit continuer à ignorer "user truthy" (voir
      // GuestGuard.tsx) — seule la fermeture de CreateEnterpriseFlow (succès ou
      // annulation) l'efface, plus bas.
      setCreateOpen(true)
    } else {
      // Le changement de route (/activate) sort de la portée de GuestGuard de toute
      // façon — sûr d'effacer l'intention ici.
      setPendingIntent(null)
      const returnQuery = sessionStorage.getItem('rmm_activate_return_query') ?? ''
      sessionStorage.removeItem('rmm_activate_return_query')
      navigate(`/activate${returnQuery}`)
    }
  }, [pendingIntent, hasPersonalAccount, navigate, setPendingIntent])

  // Identique à SignupPage/LoginPage (non touchés, voir plan) — dupliqué ici plutôt que
  // partagé, pour ne rien risquer sur ces deux écrans qui restent inchangés.
  const continueWithGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      const returnTo = `${window.location.origin}/auth/google/callback`
      const res = await apiFetch(`/mailbox-connections/gmail/start-signin?returnTo=${encodeURIComponent(returnTo)}`)
      if (!res.ok) {
        setError(await parseError(res, 'Connexion Google indisponible.'))
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      setError(networkErrorMessage(err))
      setGoogleLoading(false)
    }
  }

  const selectProvider = (id: WelcomeProvider) => {
    setError('')
    if (id === 'google') {
      void continueWithGoogle()
      return
    }
    if (id === 'create-enterprise' || id === 'join-enterprise') {
      // Créer/rejoindre une entreprise exige une identité personnelle préalable
      // (décision produit — voir plan Phase 2) : sans ça, on met l'intention en attente
      // et on laisse l'utilisateur choisir un fournisseur perso ci-dessous ; l'effet
      // ci-dessus reprend automatiquement dès que hasPersonalAccount devient vrai.
      if (!hasPersonalAccount) {
        setPendingIntent(id)
        return
      }
      if (id === 'create-enterprise') setCreateOpen(true)
      else navigate('/activate')
      return
    }
    setFormPreset(id === 'other' ? undefined : MAILBOX_PRESETS[id])
    setFormOpen(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-lg shadow-sm border border-border p-8">
        <div className="flex items-center gap-2.5 mb-1">
          <img src="/web-app-manifest-192x192.png" alt="Re-Mail" className="w-7 h-7 rounded-md flex-shrink-0" />
          <h1 className="text-lg font-semibold">Bienvenue sur Re-Mail</h1>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          {pendingIntent
            ? 'Connectez d’abord votre identité personnelle — nous reprendrons ensuite.'
            : 'Choisissez le service de messagerie à connecter.'}
        </p>

        <div className="-mx-8 divide-y divide-border border-t border-b border-border">
          {ENTRIES.filter(entry => !pendingIntent || (entry.id !== 'create-enterprise' && entry.id !== 'join-enterprise')).map(entry => (
            <button
              key={entry.id}
              type="button"
              onClick={() => selectProvider(entry.id)}
              disabled={entry.id === 'google' && googleLoading}
              className="w-full flex items-center gap-3 px-8 py-3.5 text-left hover:bg-accent transition-colors disabled:opacity-50"
            >
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">{entry.icon}</span>
              <span className="flex-1 text-sm text-foreground">{entry.label}</span>
              <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-destructive mt-4">{error}</p>}
        {pendingIntent && (
          <button
            type="button"
            onClick={() => setPendingIntent(null)}
            className="text-xs text-muted-foreground mt-4 hover:underline"
          >
            Annuler
          </button>
        )}

        <p className="text-xs text-muted-foreground mt-6 text-center">
          <Link to="/login" className="text-foreground font-medium hover:underline">Se connecter avec nom d'utilisateur / mot de passe</Link>
        </p>
      </div>

      <MailboxConnectionFormModal
        open={formOpen}
        mode="signin"
        preset={formPreset}
        onClose={() => setFormOpen(false)}
        onSaved={() => setFormOpen(false)}
      />
      <CreateEnterpriseFlow
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setPendingIntent(null)
        }}
      />
    </div>
  )
}
