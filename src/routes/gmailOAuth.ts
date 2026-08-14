import { Router } from 'express'
import { ImapFlow } from 'imapflow'
import config from '../config'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import { encryptMailboxCredential } from '../lib/mailboxCredentialCrypto'
import { signOAuthState, verifyOAuthState, OAuthState } from '../lib/oauthState'
import { buildGoogleAuthUrl, exchangeCodeForTokens, getGoogleUserEmail } from '../lib/googleOAuth'

const router = Router()

const GMAIL_IMAP_HOST = 'imap.gmail.com'
const GMAIL_SMTP_HOST = 'smtp.gmail.com'

// N'accepte que les destinations connues de l'app : la page /mailboxes du dashboard web,
// ou le scheme mobile (natif re-mail://, ou son proxy exp:// sous Expo Go en dev) — sinon
// /gmail/callback deviendrait une redirection ouverte (open redirect) vers n'importe où.
function isAllowedReturnTo(returnTo: unknown): returnTo is string {
  return (
    typeof returnTo === 'string' &&
    (returnTo === `${config.frontendUrl}/mailboxes` || returnTo.startsWith('re-mail://') || returnTo.startsWith('exp://'))
  )
}

function withError(returnTo: string, error: string): string {
  try {
    const url = new URL(returnTo)
    url.searchParams.set('error', error)
    return url.toString()
  } catch {
    const sep = returnTo.includes('?') ? '&' : '?'
    return `${returnTo}${sep}error=${encodeURIComponent(error)}`
  }
}

// GET /api/mailbox-connections/gmail/start — authentifié normalement (appelée via
// fetch, pas une navigation) : renvoie l'URL de consentement Google, c'est l'appelant
// (web/mobile) qui déclenche le vrai redirect/navigateur.
router.get('/gmail/start', authenticateToken, (req, res) => {
  if (!config.googleOAuthClientId || !config.googleOAuthClientSecret) {
    return res.status(400).json({ error: 'Gmail OAuth non configuré sur ce serveur.' })
  }
  const returnTo = req.query.returnTo
  if (!isAllowedReturnTo(returnTo)) {
    return res.status(400).json({ error: 'returnTo invalide.' })
  }
  const state = signOAuthState({ userId: req.user!.id, organizationId: req.user!.organizationId, returnTo })
  res.json({ url: buildGoogleAuthUrl(state) })
})

// GET /api/mailbox-connections/gmail/callback — PAS authenticateToken : c'est une
// navigation GET déclenchée par Google, jamais d'en-tête Authorization possible (cette
// app authentifie tout le reste par JWT en header, jamais par cookie). Le state signé
// (voir oauthState.ts) fait office d'authentification pour cette route précise.
router.get('/gmail/callback', async (req, res) => {
  const fallbackReturnTo = `${config.frontendUrl}/mailboxes`

  let state: OAuthState | null = null
  try {
    state = verifyOAuthState(typeof req.query.state === 'string' ? req.query.state : '')
  } catch {
    // state absent/altéré/expiré — rien de fiable à en tirer.
  }

  if (req.query.error) {
    const returnTo = state && isAllowedReturnTo(state.returnTo) ? state.returnTo : fallbackReturnTo
    return res.redirect(withError(returnTo, 'oauth_denied'))
  }

  if (!state || !isAllowedReturnTo(state.returnTo)) {
    return res.redirect(withError(fallbackReturnTo, 'state_invalid'))
  }
  const { returnTo, userId, organizationId } = state

  const code = typeof req.query.code === 'string' ? req.query.code : ''
  if (!code) return res.redirect(withError(returnTo, 'state_invalid'))

  let refreshToken: string
  let accessToken: string
  try {
    const tokens = await exchangeCodeForTokens(code)
    refreshToken = tokens.refreshToken
    accessToken = tokens.accessToken
  } catch (e) {
    console.error('[GMAIL-OAUTH] exchangeCodeForTokens', (e as Error).message)
    return res.redirect(withError(returnTo, 'token_exchange_failed'))
  }

  let email: string
  try {
    email = await getGoogleUserEmail(accessToken)
  } catch (e) {
    console.error('[GMAIL-OAUTH] getGoogleUserEmail', (e as Error).message)
    return res.redirect(withError(returnTo, 'token_exchange_failed'))
  }

  // Vérifié avant la sonde IMAP (pas seulement avant l'écriture finale) : évite un appel
  // Gmail inutile quand l'adresse est déjà connectée par un AUTRE utilisateur de l'org —
  // refuser plutôt que de réassigner silencieusement la connexion (comportement cohérent
  // avec le 409 du flux IMAP générique, voir POST /mailbox-connections).
  const db = forOrg(organizationId)
  const existing = await db.externalMailboxConnection.findFirst({ where: { email } })
  if (existing && existing.userId !== userId) {
    return res.redirect(withError(returnTo, 'already_connected_by_another_user'))
  }

  // Sonde IMAP en XOAUTH2 avec l'accessToken fraîchement obtenu — même logique que
  // POST /mailbox-connections générique : capture uidValidity/uidNext pour démarrer le
  // polling à partir de maintenant, pas un rapatriement complet de la boîte.
  let uidValidity: bigint
  let uidNext: number
  const client = new ImapFlow({ host: GMAIL_IMAP_HOST, port: 993, secure: true, auth: { user: email, accessToken }, logger: false })
  try {
    await client.connect()
    const box = await client.mailboxOpen('INBOX')
    uidValidity = box.uidValidity
    uidNext = box.uidNext
  } catch (e) {
    console.error('[GMAIL-OAUTH] sonde IMAP', (e as Error).message)
    return res.redirect(withError(returnTo, 'token_exchange_failed'))
  } finally {
    client.logout().catch(() => client.close())
  }

  try {
    // Unicité composite avec organizationId ([organizationId, email]) — findFirst (déjà
    // fait ci-dessus) + create/update manuel plutôt que upsert/findUnique, convention de
    // ce codebase (voir src/routes/routingRules.ts) : reconnecter un Gmail déjà en erreur
    // doit rafraîchir credentialEnc, pas planter en 409.
    const connectionData = {
      provider: 'gmail',
      imapHost: GMAIL_IMAP_HOST,
      imapPort: 993,
      imapSecure: true,
      smtpHost: GMAIL_SMTP_HOST,
      smtpPort: 465,
      smtpSecure: true,
      credentialEnc: encryptMailboxCredential(refreshToken),
      status: 'connected',
      lastError: null,
      uidValidity,
      lastSeenUid: Math.max(uidNext - 1, 0),
    }
    if (existing) {
      // Écrase aussi provider/hosts/ports, pas seulement l'identifiant : une adresse
      // reconnectée ici a pu exister avant en tant que connexion IMAP générique
      // (provider: 'imap') — sans ça, credentialEnc contiendrait un refresh token OAuth
      // tout en gardant provider: 'imap', et getMailboxAuth le traiterait comme un mot
      // de passe classique au prochain poll/envoi.
      await db.externalMailboxConnection.update({ where: { id: existing.id }, data: connectionData })
    } else {
      await db.externalMailboxConnection.create({ data: { ...connectionData, organizationId, userId, email } })
    }
  } catch (e) {
    console.error('[GMAIL-OAUTH] enregistrement connexion', (e as Error).message)
    return res.redirect(withError(returnTo, 'token_exchange_failed'))
  }

  res.redirect(returnTo)
})

export default router
