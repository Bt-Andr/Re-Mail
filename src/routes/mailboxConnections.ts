import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import prisma from '../lib/prisma'
import { decryptMailboxCredential, encryptMailboxCredential } from '../lib/mailboxCredentialCrypto'
import { MailboxProviderError } from '../lib/mailboxErrors'
import { hasPrismaErrorCode } from '../lib/prismaErrors'
import { signToken } from '../lib/jwt'
import { createPersonalAccountFromMailbox } from '../lib/personalAccountFactory'
import { importMailboxHistory } from '../jobs/mailboxPoller'
import { parseRequest } from '../validation/request'
import {
  mailboxConnectionIdParamSchema,
  mailboxCredentialsSchema,
  mailboxHistoryImportSchema,
} from '../validation/schemas'

const router = Router()

interface ImapCredentials {
  email: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  password: string
}

interface SmtpCredentials {
  email: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  password: string
}

// Sonde partagée entre POST / (authentifié, ajoute une boîte) et POST /imap/signin
// (public, crée/reconnecte un compte) — même principe que connectGmailMailbox dans
// gmailOAuth.ts, partagée entre ses intents 'connect' et 'signin'. Lève une erreur avec
// un message déjà formaté pour l'appelant (les deux routes le renvoient tel quel).
async function probeImapMailbox(creds: ImapCredentials): Promise<{ uidValidity: bigint; uidNext: number }> {
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapSecure,
    doSTARTTLS: !creds.imapSecure,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  })
  try {
    await client.connect()
    const box = await client.mailboxOpen('INBOX')
    return { uidValidity: box.uidValidity, uidNext: box.uidNext }
  } catch (e) {
    throw new MailboxProviderError('IMAP', { cause: e })
  } finally {
    client.logout().catch(() => client.close())
  }
}

async function probeSmtp(creds: SmtpCredentials): Promise<void> {
  try {
    const transporter = nodemailer.createTransport({
      host: creds.smtpHost,
      port: creds.smtpPort,
      secure: creds.smtpSecure,
      requireTLS: !creds.smtpSecure,
      auth: { user: creds.email, pass: creds.password },
    })
    await transporter.verify()
  } catch (e) {
    throw new MailboxProviderError('SMTP', { cause: e })
  }
}

const LIST_SELECT = {
  id: true,
  provider: true,
  email: true,
  imapHost: true,
  imapPort: true,
  imapSecure: true,
  smtpHost: true,
  smtpPort: true,
  smtpSecure: true,
  status: true,
  lastError: true,
  lastPolledAt: true,
  historyImportedAt: true,
  createdAt: true,
} as const

// GET /api/mailbox-connections — identifiant PERSONNEL, jamais listé à l'échelle de
// l'org (contrairement à /api/mail-routes) : un OWNER/ADMIN n'a aucune raison de voir
// la boîte perso d'un coéquipier.
router.get('/', authenticateToken, async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const connections = await db.externalMailboxConnection.findMany({
    where: { userId: req.user!.id },
    select: LIST_SELECT,
    orderBy: { createdAt: 'desc' },
  })
  res.json(connections)
})

// POST /api/mailbox-connections — teste la connexion IMAP ET SMTP en direct avant
// d'enregistrer quoi que ce soit : mieux vaut un 400 immédiat et stable qu'un
// identifiant mort stocké silencieusement. Le détail interne du fournisseur n'est
// jamais renvoyé au client.
router.post('/', authenticateToken, async (req, res) => {
  const input = parseRequest(mailboxCredentialsSchema, req.body, res)
  if (!input) return
  const { email, imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure, password } = input

  let uidValidity: bigint
  let uidNext: number
  try {
    const probe = await probeImapMailbox({ email, imapHost, imapPort, imapSecure, password })
    uidValidity = probe.uidValidity
    uidNext = probe.uidNext
  } catch (e) {
    if (e instanceof MailboxProviderError) return res.status(400).json({ error: e.message })
    throw e
  }

  try {
    await probeSmtp({ email, smtpHost, smtpPort, smtpSecure, password })
  } catch (e) {
    if (e instanceof MailboxProviderError) return res.status(400).json({ error: e.message })
    throw e
  }

  try {
    const db = forOrg(req.user!.organizationId)
    const connection = await db.externalMailboxConnection.create({
      data: {
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        provider: 'imap',
        email,
        imapHost,
        imapPort,
        imapSecure,
        smtpHost,
        smtpPort,
        smtpSecure,
        credentialEnc: encryptMailboxCredential(password),
        status: 'connected',
        uidValidity,
        // Démarre le polling à partir de maintenant, pas un rapatriement complet de la
        // boîte — même logique que le webhook Resend qui ne traite que le nouveau courrier.
        lastSeenUid: Math.max(uidNext - 1, 0),
      },
      select: LIST_SELECT,
    })
    res.status(201).json(connection)
  } catch (e) {
    if (hasPrismaErrorCode(e, 'P2002')) return res.status(409).json({ error: 'Cette adresse est déjà connectée.' })
    throw e
  }
})

// Ni POST /imap/signin n'a de protection par compte (juste la sonde IMAP elle-même) —
// limite par IP, même motif que loginLimiter (routes/auth.ts) et
// googleSignInStartLimiter (gmailOAuth.ts).
const imapSigninLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
})

// POST /api/mailbox-connections/imap/signin — PAS authenticateToken : point d'entrée de
// connexion symétrique à /gmail/start-signin, mais sans redirection OAuth (identifiants
// IMAP directs, pas de navigateur tiers à traverser) — réponse synchrone avec la session,
// pas besoin du mécanisme de jeton d'échange à usage unique (voir lib/loginHandoff.ts,
// qui existe uniquement pour ne jamais mettre le vrai JWT dans une URL de redirection).
//
// Réplique exactement les deux branches de gmailOAuth.ts (intent 'signin') : email
// inconnu -> compte perso créé à la volée (createPersonalAccountFromMailbox) ; email déjà
// existant (perso OU d'équipe) -> reconnexion, vraie session directement — voir la note
// plus bas sur la décision produit qui a supprimé la distinction perso/équipe ici.
router.post('/imap/signin', imapSigninLimiter, async (req, res) => {
  const input = parseRequest(mailboxCredentialsSchema, req.body, res)
  if (!input) return
  const { email, imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure, password } = input

  let uidNext: number
  try {
    uidNext = (await probeImapMailbox({ email, imapHost, imapPort, imapSecure, password })).uidNext
    await probeSmtp({ email, smtpHost, smtpPort, smtpSecure, password })
  } catch (e) {
    if (e instanceof MailboxProviderError) return res.status(400).json({ error: e.message })
    throw e
  }

  // Résout UNIQUEMENT un compte personnel existant (voir gmailOAuth.ts pour le même
  // principe et sa justification complète) — jamais un compte d'organisation, même si
  // cet email est aussi le contact d'un OWNER/ADMIN ailleurs. email n'est plus unique
  // globalement (schema.prisma), d'où le findFirst + orderBy déterministe plutôt qu'un
  // findUnique désormais impossible.
  const existingUser = await prisma.user.findFirst({
    where: { email, organization: { isPersonal: true } },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })

  const attachMailbox = async (organizationId: string, userId: string) => {
    const db = forOrg(organizationId)
    const existingConnection = await db.externalMailboxConnection.findFirst({ where: { email } })
    if (existingConnection && existingConnection.userId !== userId) return false
    const data = {
      provider: 'imap',
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
      credentialEnc: encryptMailboxCredential(password),
      status: 'connected',
      lastError: null,
      lastSeenUid: Math.max(uidNext - 1, 0),
    }
    if (existingConnection) {
      await db.externalMailboxConnection.update({ where: { id: existingConnection.id }, data })
    } else {
      await db.externalMailboxConnection.create({ data: { ...data, organizationId, userId, email } })
    }
    return true
  }

  let userId: string
  let organizationId: string
  if (existingUser) {
    userId = existingUser.id
    organizationId = existingUser.organizationId
  } else {
    const created = await createPersonalAccountFromMailbox(email)
    userId = created.user.id
    organizationId = created.organization.id
  }

  const attached = await attachMailbox(organizationId, userId)
  if (!attached) return res.status(409).json({ error: 'Cette adresse est déjà connectée par un autre membre de cette organisation.' })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: { select: { id: true, name: true, slug: true, isPersonal: true, _count: { select: { users: true } } } } },
  })
  const token = signToken(user!)
  res.json({
    token,
    user: { id: user!.id, username: user!.username, nom: user!.nom, email: user!.email, orgRole: user!.orgRole },
    organization: {
      id: user!.organization.id,
      name: user!.organization.name,
      slug: user!.organization.slug,
      isPersonal: user!.organization.isPersonal,
      memberCount: user!.organization._count.users,
    },
  })
})

router.delete('/:id', authenticateToken, async (req, res) => {
  const input = parseRequest(mailboxConnectionIdParamSchema, req.params, res)
  if (!input) return
  const db = forOrg(req.user!.organizationId)
  const deleted = await db.externalMailboxConnection.deleteMany({ where: { id: input.id, userId: req.user!.id } })
  if (deleted.count === 0) return res.status(404).json({ error: 'Connexion introuvable.' })
  res.status(204).end()
})

// Réparation explicite : les nouveaux paramètres et le nouveau secret ne remplacent
// jamais ceux qui fonctionnaient avant que les deux sondes aient réussi. L'adresse est
// volontairement immuable pour ne pas rattacher silencieusement les fils existants à
// une autre boîte.
router.patch('/:id/reconnect', authenticateToken, async (req, res) => {
  const params = parseRequest(mailboxConnectionIdParamSchema, req.params, res)
  if (!params) return
  const input = parseRequest(mailboxCredentialsSchema, req.body, res)
  if (!input) return
  const db = forOrg(req.user!.organizationId)
  const existing = await db.externalMailboxConnection.findFirst({ where: { id: params.id, userId: req.user!.id } })
  if (!existing) return res.status(404).json({ error: 'Connexion introuvable.' })
  if (existing.provider !== 'imap') {
    return res.status(400).json({ error: 'Reconnectez cette boîte avec le fournisseur OAuth correspondant.' })
  }
  if (input.email !== existing.email.toLowerCase()) {
    return res.status(400).json({ error: "L'adresse d'une boîte existante ne peut pas être modifiée." })
  }

  let probe: Awaited<ReturnType<typeof probeImapMailbox>>
  try {
    probe = await probeImapMailbox(input)
    await probeSmtp(input)
  } catch (e) {
    if (e instanceof MailboxProviderError) return res.status(400).json({ error: e.message })
    throw e
  }

  const uidValidityChanged = existing.uidValidity !== null && existing.uidValidity !== probe.uidValidity
  const updated = await db.externalMailboxConnection.update({
    where: { id: existing.id },
    data: {
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      imapSecure: input.imapSecure,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpSecure: input.smtpSecure,
      credentialEnc: encryptMailboxCredential(input.password),
      status: 'connected',
      lastError: null,
      uidValidity: probe.uidValidity,
      lastSeenUid: uidValidityChanged ? 0 : existing.lastSeenUid,
    },
    select: LIST_SELECT,
  })
  res.json(updated)
})

// PATCH /api/mailbox-connections/:id/retry — le poller passe une connexion en erreur
// en `status: 'error'` et ne la retente plus jamais tout seul. Une tentative avec les
// identifiants déjà stockés doit elle aussi réussir en IMAP ET SMTP avant de réarmer le
// poller ; l'ancien comportement mettait aveuglément la connexion au vert.
router.patch('/:id/retry', authenticateToken, async (req, res) => {
  const input = parseRequest(mailboxConnectionIdParamSchema, req.params, res)
  if (!input) return
  const db = forOrg(req.user!.organizationId)
  const existing = await db.externalMailboxConnection.findFirst({ where: { id: input.id, userId: req.user!.id } })
  if (!existing) return res.status(404).json({ error: 'Connexion introuvable.' })
  if (existing.provider !== 'imap') {
    return res.status(400).json({ error: 'Reconnectez cette boîte avec le fournisseur OAuth correspondant.' })
  }

  let probe: Awaited<ReturnType<typeof probeImapMailbox>>
  try {
    const password = decryptMailboxCredential(existing.credentialEnc)
    probe = await probeImapMailbox({
      email: existing.email,
      imapHost: existing.imapHost,
      imapPort: existing.imapPort,
      imapSecure: existing.imapSecure,
      password,
    })
    await probeSmtp({
      email: existing.email,
      smtpHost: existing.smtpHost,
      smtpPort: existing.smtpPort,
      smtpSecure: existing.smtpSecure,
      password,
    })
  } catch (e) {
    if (e instanceof MailboxProviderError) return res.status(400).json({ error: e.message })
    throw e
  }

  const uidValidityChanged = existing.uidValidity !== null && existing.uidValidity !== probe.uidValidity
  await db.externalMailboxConnection.update({
    where: { id: existing.id },
    data: {
      status: 'connected',
      lastError: null,
      uidValidity: probe.uidValidity,
      lastSeenUid: uidValidityChanged ? 0 : existing.lastSeenUid,
    },
  })
  res.json({ success: true })
})

// POST /api/mailbox-connections/:id/import-history — action ponctuelle et bornée
// (voir importMailboxHistory) : contrairement au polling normal, elle est synchrone
// et peut prendre du temps selon le volume de courrier sur la période demandée —
// `days` reste volontairement plafonné pour éviter une requête interminable ou un
// import massif silencieux.
router.post('/:id/import-history', authenticateToken, async (req, res) => {
  const params = parseRequest(mailboxConnectionIdParamSchema, req.params, res)
  if (!params) return
  const db = forOrg(req.user!.organizationId)
  const connection = await db.externalMailboxConnection.findFirst({ where: { id: params.id, userId: req.user!.id } })
  if (!connection) return res.status(404).json({ error: 'Connexion introuvable.' })
  if (connection.historyImportedAt) return res.status(409).json({ error: 'Historique déjà importé pour cette boîte.' })

  const input = parseRequest(mailboxHistoryImportSchema, req.body, res)
  if (!input) return

  try {
    const { imported } = await importMailboxHistory(connection, input.days)
    res.json({ imported })
  } catch (e) {
    if (e instanceof MailboxProviderError) return res.status(400).json({ error: e.message })
    throw e
  }
})

export default router
