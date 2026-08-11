import { Router } from 'express'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import { encryptMailboxCredential } from '../lib/mailboxCredentialCrypto'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  const client = new ImapFlow({
    host: imapHost.trim(),
    port: imapPort,
    secure: imapSecure,
    auth: { user: email, pass: password },
    logger: false,
  })
  try {
    await client.connect()
    const box = await client.mailboxOpen('INBOX')
    uidValidity = box.uidValidity
    uidNext = box.uidNext
  } catch (e) {
    return res.status(400).json({ error: `Connexion IMAP impossible : ${(e as Error).message}` })
  } finally {
    client.logout().catch(() => client.close())
  }

  try {
    const transporter = nodemailer.createTransport({ host: smtpHost.trim(), port: smtpPort, secure: smtpSecure, auth: { user: email, pass: password } })
    await transporter.verify()
  } catch (e) {
    return res.status(400).json({ error: `Connexion SMTP impossible : ${(e as Error).message}` })
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
