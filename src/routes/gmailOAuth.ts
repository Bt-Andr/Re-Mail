import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { ImapFlow } from 'imapflow'
import config from '../config'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import prisma from '../lib/prisma'
import { encryptMailboxCredential } from '../lib/mailboxCredentialCrypto'
import { signOAuthState, verifyOAuthState, OAuthState } from '../lib/oauthState'
import { buildGoogleAuthUrl, exchangeCodeForTokens, getGoogleUserEmail } from '../lib/googleOAuth'
import { createPersonalAccountFromGoogle } from '../lib/personalAccountFactory'
import { issueLoginHandoff } from '../lib/loginHandoff'

const router = Router()

const GMAIL_IMAP_HOST = 'imap.gmail.com'
const GMAIL_SMTP_HOST = 'smtp.gmail.com'

// Ni /gmail/start-signin ni /gmail/callback n'ont de protection par compte (état signé
// à la place) — limite par IP, même motif que loginLimiter (routes/auth.ts).
const googleSignInStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
})

// Deux destinations web distinctes selon l'intent : un state 'signin' ne doit jamais
// pouvoir rediriger vers /mailboxes (page authentifiée), ni un state 'connect' vers
// /auth/google/callback (page publique) — surface d'attaque inutile sinon.
const WEB_CONNECT_RETURN_TO = `${config.frontendUrl}/mailboxes`
const WEB_SIGNIN_RETURN_TO = `${config.frontendUrl}/auth/google/callback`

// N'accepte que les destinations connues de l'app : la page correspondant à l'intent
// dans le dashboard web, ou le scheme mobile (natif re-mail://, ou son proxy exp:// sous
// Expo Go en dev) — sinon /gmail/callback deviendrait une redirection ouverte (open
// redirect) vers n'importe où.
function isAllowedReturnTo(returnTo: unknown, intent: 'connect' | 'signin'): returnTo is string {
  if (typeof returnTo !== 'string') return false
  if (returnTo.startsWith('re-mail://') || returnTo.startsWith('exp://')) return true
  return intent === 'connect' ? returnTo === WEB_CONNECT_RETURN_TO : returnTo === WEB_SIGNIN_RETURN_TO
}

function appendQueryParam(returnTo: string, key: string, value: string): string {
  try {
    const url = new URL(returnTo)
    url.searchParams.set(key, value)
    return url.toString()
  } catch {
    const sep = returnTo.includes('?') ? '&' : '?'
    return `${returnTo}${sep}${key}=${encodeURIComponent(value)}`
  }
}

function withError(returnTo: string, error: string): string {
  return appendQueryParam(returnTo, 'error', error)
}

// GET /api/mailbox-connections/gmail/start — authentifié normalement (appelée via
// fetch, pas une navigation) : renvoie l'URL de consentement Google, c'est l'appelant
// (web/mobile) qui déclenche le vrai redirect/navigateur.
router.get('/gmail/start', authenticateToken, (req, res) => {
  if (!config.googleOAuthClientId || !config.googleOAuthClientSecret) {
    return res.status(400).json({ error: 'Gmail OAuth non configuré sur ce serveur.' })
  }
  const returnTo = req.query.returnTo
  if (!isAllowedReturnTo(returnTo, 'connect')) {
    return res.status(400).json({ error: 'returnTo invalide.' })
  }
  const state = signOAuthState({ intent: 'connect', userId: req.user!.id, organizationId: req.user!.organizationId, returnTo })
  res.json({ url: buildGoogleAuthUrl(state) })
})

// GET /api/mailbox-connections/gmail/start-signin — PAS authenticateToken : c'est le
// point d'entrée "se connecter avec Google" depuis l'écran de connexion, avant toute
// session Re-Mail. Le callback (même route que /gmail/start, voir plus bas) résout
// l'identité de l'utilisateur lui-même une fois l'email Google vérifié.
router.get('/gmail/start-signin', googleSignInStartLimiter, (req, res) => {
  if (!config.googleOAuthClientId || !config.googleOAuthClientSecret) {
    return res.status(400).json({ error: 'Gmail OAuth non configuré sur ce serveur.' })
  }
  const returnTo = req.query.returnTo
  if (!isAllowedReturnTo(returnTo, 'signin')) {
    return res.status(400).json({ error: 'returnTo invalide.' })
  }
  const state = signOAuthState({ intent: 'signin', returnTo })
  res.json({ url: buildGoogleAuthUrl(state) })
})

type ConnectResult = { ok: true } | { ok: false; error: 'already_connected_by_another_user' | 'token_exchange_failed' }

// Partagée par les deux intents du callback : vérifie qu'aucun AUTRE utilisateur de
// l'org n'a déjà connecté cette adresse, sonde IMAP en XOAUTH2 pour capturer
// uidValidity/uidNext (démarre le polling à partir de maintenant, pas un rapatriement
// complet), puis crée ou met à jour la ExternalMailboxConnection. Écrase aussi
// provider/hosts/ports au update, pas seulement l'identifiant : une adresse reconnectée
// ici a pu exister avant en tant que connexion IMAP générique (provider: 'imap').
async function connectGmailMailbox(
  organizationId: string,
  userId: string,
  email: string,
  refreshToken: string,
  accessToken: string
): Promise<ConnectResult> {
  const db = forOrg(organizationId)
  const existing = await db.externalMailboxConnection.findFirst({ where: { email } })
  if (existing && existing.userId !== userId) {
    return { ok: false, error: 'already_connected_by_another_user' }
  }

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
    return { ok: false, error: 'token_exchange_failed' }
  } finally {
    client.logout().catch(() => client.close())
  }

  try {
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
      await db.externalMailboxConnection.update({ where: { id: existing.id }, data: connectionData })
    } else {
      await db.externalMailboxConnection.create({ data: { ...connectionData, organizationId, userId, email } })
    }
  } catch (e) {
    console.error('[GMAIL-OAUTH] enregistrement connexion', (e as Error).message)
    return { ok: false, error: 'token_exchange_failed' }
  }

  return { ok: true }
}

// GET /api/mailbox-connections/gmail/callback — PAS authenticateToken : c'est une
// navigation GET déclenchée par Google, jamais d'en-tête Authorization possible (cette
// app authentifie tout le reste par JWT en header, jamais par cookie). Le state signé
// (voir oauthState.ts) fait office d'authentification pour cette route précise. Reçoit
// indifféremment les deux intents ('connect' et 'signin') : un seul callback, une seule
// redirect URI enregistrée côté Google Cloud Console, comportement branché sur le state.
router.get('/gmail/callback', async (req, res) => {
  const fallbackReturnTo = `${config.frontendUrl}/mailboxes`

  let state: OAuthState | null = null
  try {
    state = verifyOAuthState(typeof req.query.state === 'string' ? req.query.state : '')
  } catch {
    // state absent/altéré/expiré — rien de fiable à en tirer.
  }

  if (req.query.error) {
    const returnTo = state && isAllowedReturnTo(state.returnTo, state.intent) ? state.returnTo : fallbackReturnTo
    return res.redirect(withError(returnTo, 'oauth_denied'))
  }

  if (!state || !isAllowedReturnTo(state.returnTo, state.intent)) {
    return res.redirect(withError(fallbackReturnTo, 'state_invalid'))
  }
  const { returnTo, intent } = state

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
    email = (await getGoogleUserEmail(accessToken)).toLowerCase().trim()
  } catch (e) {
    console.error('[GMAIL-OAUTH] getGoogleUserEmail', (e as Error).message)
    return res.redirect(withError(returnTo, 'token_exchange_failed'))
  }

  if (intent === 'connect') {
    const { userId, organizationId } = state
    const result = await connectGmailMailbox(organizationId, userId, email, refreshToken, accessToken)
    if (!result.ok) return res.redirect(withError(returnTo, result.error))
    return res.redirect(returnTo)
  }

  // intent === 'signin' : aucune session préalable — résout un compte perso existant par
  // email (lookup global raw prisma, avant que l'org soit connue — même exception
  // documentée que auth.ts /login et publicUserInvites.ts), ou en crée un à la volée.
  let userId: string
  let organizationId: string
  try {
    const existingUser = await prisma.user.findUnique({ where: { email }, include: { organization: true } })
    if (existingUser && !existingUser.organization.isPersonal) {
      // Compte d'équipe existant avec cet email — on ne délivre PAS de session via ce
      // mécanisme pensé pour le perso (portée validée avec l'utilisateur : le mot de passe
      // reste requis pour accéder à un compte pro), mais on connecte quand même le Gmail à
      // ce compte : réussir l'OAuth Google prouve la possession de l'adresse aussi
      // fiablement qu'un mot de passe, et ça évite une manipulation manuelle redondante
      // dans Boîtes externes une fois connecté normalement.
      // Erreur volontairement réutilisée telle quelle (pas de code dédié type
      // 'pro_account_use_password') : un code distinct confirmerait à quiconque complète
      // l'OAuth Google pour une adresse donnée que cette adresse est un compte d'équipe —
      // même principe que GENERIC_INVITE_ERROR dans publicUserInvites.ts, ne jamais laisser
      // un appelant non authentifié distinguer les cas d'échec.
      const result = await connectGmailMailbox(existingUser.organizationId, existingUser.id, email, refreshToken, accessToken)
      return res.redirect(withError(returnTo, result.ok ? 'account_provisioning_failed' : result.error))
    }
    if (existingUser) {
      userId = existingUser.id
      organizationId = existingUser.organizationId
    } else {
      const created = await createPersonalAccountFromGoogle(email)
      userId = created.user.id
      organizationId = created.organization.id
    }
  } catch (e) {
    console.error('[GMAIL-OAUTH] provisionnement compte', (e as Error).message)
    return res.redirect(withError(returnTo, 'account_provisioning_failed'))
  }

  const result = await connectGmailMailbox(organizationId, userId, email, refreshToken, accessToken)
  if (!result.ok) return res.redirect(withError(returnTo, result.error))

  // Jamais le vrai JWT de session dans cette URL de redirection (historique navigateur,
  // logs serveur, referrer) — un jeton d'échange à usage unique et très court (60s) à la
  // place, consommé par POST /auth/google/exchange qui renvoie la vraie session.
  const handoff = await issueLoginHandoff(userId)
  res.redirect(appendQueryParam(returnTo, 'handoff', handoff))
})

export default router
