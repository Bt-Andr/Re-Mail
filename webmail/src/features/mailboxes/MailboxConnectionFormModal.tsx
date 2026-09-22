import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, networkErrorMessage, parseError } from '../../lib/apiClient'
import { useSession } from '../../context/SessionContext'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import type { ExternalMailboxConnection } from '../../types/api'

const EMPTY = {
  email: '',
  imapHost: '',
  imapPort: '993',
  imapSecure: true,
  smtpHost: '',
  smtpPort: '465',
  smtpSecure: true,
  password: '',
}

// Préréglages hôte/port par fournisseur — réduit la friction de saisie pour l'écran
// "ajouter un compte" (voir ProviderPickerModal). Pas d'OAuth pour ces fournisseurs
// (seul Google en a un, voir connectGmail) : ça reste le connecteur IMAP générique,
// juste avec les champs serveur déjà remplis.
export const MAILBOX_PRESETS: Record<string, Partial<typeof EMPTY>> = {
  outlook: { imapHost: 'outlook.office365.com', imapPort: '993', smtpHost: 'smtp-mail.outlook.com', smtpPort: '587', smtpSecure: false },
  yahoo: { imapHost: 'export.imap.mail.yahoo.com', imapPort: '993', smtpHost: 'smtp.mail.yahoo.com', smtpPort: '465', smtpSecure: true },
  exchange: { imapPort: '993', smtpPort: '587', smtpSecure: false },
}

export type ManualMailboxProvider = 'outlook' | 'yahoo' | 'exchange' | 'other'

const PROVIDER_GUIDANCE: Record<ManualMailboxProvider, string> = {
  outlook: "Microsoft exige l'authentification moderne OAuth2. Cette connexion manuelle ne peut fonctionner que si votre compte ou votre administrateur autorise un mot de passe d'application ; sinon utilisez votre fournisseur officiel en attendant l'intégration OAuth Microsoft.",
  yahoo: "Créez un mot de passe d'application dans Sécurité du compte Yahoo, puis collez ce code ici. Votre mot de passe Yahoo habituel est généralement refusé par les applications tierces.",
  exchange: "Les serveurs Exchange dépendent de votre organisation. Demandez les hôtes IMAP/SMTP et la méthode d'authentification à votre administrateur ; Microsoft 365 impose généralement OAuth2.",
  other: "Utilisez les paramètres IMAP et SMTP fournis par votre hébergeur. Le serveur teste la réception puis l'envoi avant d'enregistrer la connexion.",
}

const PROVIDER_HELP: Partial<Record<ManualMailboxProvider, { label: string; url: string }>> = {
  outlook: { label: 'Voir les prérequis Microsoft', url: 'https://support.microsoft.com/en-us/outlook/pop-imap-and-smtp-settings-for-outlook-com' },
  yahoo: { label: "Créer un mot de passe d'application Yahoo", url: 'https://help.yahoo.com/kb/SLN15241.html' },
  exchange: { label: 'Voir les prérequis Microsoft', url: 'https://support.microsoft.com/en-us/outlook/pop-imap-and-smtp-settings-for-outlook-com' },
}

export function inferManualMailboxProvider(connection: Pick<ExternalMailboxConnection, 'imapHost' | 'smtpHost'>): ManualMailboxProvider {
  const hosts = `${connection.imapHost} ${connection.smtpHost}`.toLowerCase()
  if (hosts.includes('yahoo')) return 'yahoo'
  if (hosts.includes('office365') || hosts.includes('outlook')) return 'outlook'
  return 'other'
}

interface MailboxConnectionFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  preset?: Partial<typeof EMPTY>
  provider?: ManualMailboxProvider
  connection?: ExternalMailboxConnection | null
  // 'connect' (défaut) : ajoute une boîte à la session existante, comportement
  // inchangé. 'signin' : aucune session requise — POST vers /imap/signin (voir
  // src/routes/mailboxConnections.ts), qui crée un compte perso à la volée si l'email
  // est inconnu et renvoie directement une session, comme "Continuer avec Google".
  mode?: 'connect' | 'signin'
}

// En réparation, l'adresse reste immuable mais les serveurs et le secret peuvent être
// ressaisis ; le backend ne les remplace qu'après validation IMAP puis SMTP.
export function MailboxConnectionFormModal({ open, onClose, onSaved, preset, provider = 'other', connection, mode = 'connect' }: MailboxConnectionFormModalProps) {
  const { login } = useSession()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const activeProvider = connection ? inferManualMailboxProvider(connection) : provider
  const providerHelp = PROVIDER_HELP[activeProvider]

  useEffect(() => {
    if (open) {
      setForm(connection
        ? {
            email: connection.email,
            imapHost: connection.imapHost,
            imapPort: String(connection.imapPort),
            imapSecure: connection.imapSecure,
            smtpHost: connection.smtpHost,
            smtpPort: String(connection.smtpPort),
            smtpSecure: connection.smtpSecure,
            password: '',
          }
        : { ...EMPTY, ...preset })
      setError('')
    }
  }, [connection, open, preset])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const canSubmit = form.email.trim() && form.imapHost.trim() && form.smtpHost.trim() && form.password

  const submit = async () => {
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      const path = mode === 'signin'
        ? '/mailbox-connections/imap/signin'
        : connection
          ? `/mailbox-connections/${connection.id}/reconnect`
          : '/mailbox-connections'
      const res = await apiFetch(path, {
        method: connection ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, imapPort: Number(form.imapPort), smtpPort: Number(form.smtpPort) }),
      })
      if (!res.ok) {
        setError(await parseError(res, 'Connexion impossible.'))
        return
      }
      if (mode === 'signin') {
        const data = await res.json()
        // IMAP signin ne résout jamais qu'un compte perso (voir Phase 1) — toujours
        // login(), jamais connectOrganization().
        login(data.token, data.user, data.organization)
        // Si ce signin a été déclenché depuis le sous-flux "connectez d'abord votre
        // identité personnelle" (WelcomePage), ne pas naviguer : WelcomePage reprend
        // l'intention en attente lui-même dès que hasPersonalAccount devient vrai.
        if (!sessionStorage.getItem('rmm_pending_intent')) navigate('/inbox')
        return
      }
      onSaved()
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={connection ? 'Réparer la connexion' : 'Connecter une boîte mail'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} loading={loading} disabled={!canSubmit}>{connection ? 'Tester et reconnecter' : 'Connecter'}</Button>
        </>
      }
    >
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p>{PROVIDER_GUIDANCE[activeProvider]}</p>
        {providerHelp && (
          <a href={providerHelp.url} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-foreground underline underline-offset-2">
            {providerHelp.label}
          </a>
        )}
      </div>
      <Input label="Adresse email" type="email" placeholder="vous@exemple.com" value={form.email} onChange={set('email')} autoFocus disabled={!!connection} />
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input label="Serveur IMAP (réception)" placeholder="imap.exemple.com" value={form.imapHost} onChange={set('imapHost')} />
        </div>
        <Input label="Port" type="number" value={form.imapPort} onChange={set('imapPort')} />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={form.imapSecure} onChange={set('imapSecure')} />
        TLS direct IMAP (généralement port 993) — décochez pour STARTTLS
      </label>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input label="Serveur SMTP (envoi)" placeholder="smtp.exemple.com" value={form.smtpHost} onChange={set('smtpHost')} />
        </div>
        <Input label="Port" type="number" value={form.smtpPort} onChange={set('smtpPort')} />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={form.smtpSecure} onChange={set('smtpSecure')} />
        TLS direct SMTP (port 465) — décochez pour STARTTLS, généralement port 587
      </label>
      <Input label={connection ? "Nouveau mot de passe ou mot de passe d'application" : "Mot de passe ou mot de passe d'application"} type="password" value={form.password} onChange={set('password')} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </Modal>
  )
}
