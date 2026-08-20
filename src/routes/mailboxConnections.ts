import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import prisma from '../lib/prisma'
import { encryptMailboxCredential } from '../lib/mailboxCredentialCrypto'
import { signToken } from '../lib/jwt'
import { createPersonalAccountFromMailbox } from '../lib/personalAccountFactory'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  })
  try {
    await client.connect()
    const box = await client.mailboxOpen('INBOX')
    return { uidValidity: box.uidValidity, uidNext: box.uidNext }
  } catch (e) {
    throw new Error(`Connexion IMAP impossible : ${(e as Error).message}`)
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
      auth: { user: creds.email, pass: creds.password },
    })
    await transporter.verify()
  } catch (e) {
    throw new Error(`Connexion SMTP impossible : ${(e as Error).message}`)
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
// d'enregistrer quoi que ce soit : mieux vaut un 400 immédiat avec l'erreur brute
// qu'un identifiant mort stocké silencieusement.
router.post('/', authenticateToken, async (req, res) => {
  const { email, imapHost, smtpHost, password } = req.body
  const imapPort = Number(req.body.imapPort)
  const smtpPort = Number(req.body.smtpPort)
  const imapSecure = req.body.imapSecure !== false
  const smtpSecure = req.body.smtpSecure !== false

  if (
    typeof email !== 'string' || !EMAIL_RE.test(email) ||
    typeof imapHost !== 'string' || !imapHost.trim() || !Number.isFinite(imapPort) ||
    typeof smtpHost !== 'string' || !smtpHost.trim() || !Number.isFinite(smtpPort) ||
    typeof password !== 'string' || !password
  ) {
    return res.status(400).json({ error: 'Champs requis manquants ou invalides.' })
  }

  let uidValidity: bigint
  let uidNext: number
  try {
    const probe = await probeImapMailbox({ email, imapHost: imapHost.trim(), imapPort, imapSecure, password })
    uidValidity = probe.uidValidity
    uidNext = probe.uidNext
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message })
  }

  try {
    await probeSmtp({ email, smtpHost: smtpHost.trim(), smtpPort, smtpSecure, password })
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message })
  }

  try {
    const db = forOrg(req.user!.organizationId)
    const connection = await db.externalMailboxConnection.create({
      data: {
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        provider: 'imap',
        email: email.toLowerCase().trim(),
        imapHost: imapHost.trim(),
        imapPort,
        imapSecure,
        smtpHost: smtpHost.trim(),
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
    const err = e as { code?: string }
    if (err.code === 'P2002') return res.status(409).json({ error: 'Cette adresse est déjà connectée.' })
    console.error('[POST /api/mailbox-connections]', e)
    res.status(500).json({ error: 'Erreur serveur.' })
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
// Réplique exactement les trois branches de gmailOAuth.ts (intent 'signin') : email
// inconnu -> compte perso créé à la volée (createPersonalAccountFromMailbox) ; email déjà
// perso -> reconnexion, vraie session ; email déjà d'équipe -> boîte attachée mais AUCUNE
// session émise (le mot de passe du compte reste requis), erreur générique — jamais
// laisser un appelant non authentifié distinguer "cet email est un compte d'équipe" d'un
// autre échec (même principe que gmailOAuth.ts:223-230).
router.post('/imap/signin', imapSigninLimiter, async (req, res) => {
  const { imapHost, smtpHost, password } = req.body
  const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : req.body.email
  const imapPort = Number(req.body.imapPort)
  const smtpPort = Number(req.body.smtpPort)
  const imapSecure = req.body.imapSecure !== false
  const smtpSecure = req.body.smtpSecure !== false

  if (
    typeof email !== 'string' || !EMAIL_RE.test(email) ||
    typeof imapHost !== 'string' || !imapHost.trim() || !Number.isFinite(imapPort) ||
    typeof smtpHost !== 'string' || !smtpHost.trim() || !Number.isFinite(smtpPort) ||
    typeof password !== 'string' || !password
  ) {
    return res.status(400).json({ error: 'Champs requis manquants ou invalides.' })
  }

  let uidNext: number
  try {
    uidNext = (await probeImapMailbox({ email, imapHost: imapHost.trim(), imapPort, imapSecure, password })).uidNext
    await probeSmtp({ email, smtpHost: smtpHost.trim(), smtpPort, smtpSecure, password })
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message })
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, include: { organization: true } })

  const attachMailbox = async (organizationId: string, userId: string) => {
    const db = forOrg(organizationId)
    const existingConnection = await db.externalMailboxConnection.findFirst({ where: { email } })
    if (existingConnection && existingConnection.userId !== userId) return false
    const data = {
      provider: 'imap',
      imapHost: imapHost.trim(),
      imapPort,
      imapSecure,
      smtpHost: smtpHost.trim(),
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

  if (existingUser && !existingUser.organization.isPersonal) {
    // Compte d'équipe existant — pas de session délivrée via ce raccourci (le mot de
    // passe reste requis pour un compte pro), mais la boîte est quand même attachée : la
    // connexion IMAP réussie prouve la possession de l'adresse aussi fiablement qu'un mot
    // de passe. Messages dédiés (pas de générique réutilisé) : l'appelant a déjà prouvé
    // cette possession avant d'atteindre cette branche, donc lui révéler l'un ou l'autre
    // cas ne fuite rien à un tiers non authentifié — seulement à quelqu'un qui contrôle
    // déjà cette boîte mail.
    const attached = await attachMailbox(existingUser.organizationId, existingUser.id)
    if (!attached) return res.status(400).json({ error: 'Cette adresse est déjà connectée par un autre membre de cette organisation.' })
    return res.status(400).json({
      error: 'Un compte d’équipe existe déjà avec cette adresse. Connectez-vous avec le nom d’utilisateur et le mot de passe de ce compte — votre boîte y est déjà rattachée.',
      code: 'account_exists_use_password',
    })
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
  if (!attached) {
    console.error('[POST /imap/signin] échec inattendu de rattachement', organizationId, userId)
    return res.status(500).json({ error: 'Erreur serveur.' })
  }

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
  const db = forOrg(req.user!.organizationId)
  const deleted = await db.externalMailboxConnection.deleteMany({ where: { id: req.params.id, userId: req.user!.id } })
  if (deleted.count === 0) return res.status(404).json({ error: 'Connexion introuvable.' })
  res.status(204).end()
})

// PATCH /api/mailbox-connections/:id/retry — le poller passe une connexion en erreur
// en `status: 'error'` et ne la retente plus jamais tout seul (coupe-circuit, voir
// src/jobs/mailboxPoller.ts) ; ce endpoint est le seul moyen de la relancer.
router.patch('/:id/retry', authenticateToken, async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const updated = await db.externalMailboxConnection.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { status: 'connected', lastError: null },
  })
  if (updated.count === 0) return res.status(404).json({ error: 'Connexion introuvable.' })
  res.json({ success: true })
})

export default router
