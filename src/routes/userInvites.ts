import crypto from 'crypto'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import { encryptInviteFile, INVITE_FILE_MAGIC } from '../lib/inviteFileCrypto'
import { buildResendClient } from '../lib/resendClient'
import { buildNotificationEmail, sendNotificationEmail } from '../lib/email'
import { getDecryptedResendKey } from '../helpers/resendAccount'
import config from '../config'

const router = Router()

// Exporté : réutilisé par POST /organizations/me/import (routes/organizations.ts)
// pour la création en masse d'invitations depuis la section CSV "Users", avec les
// mêmes règles d'expiration que la création manuelle.
export const INVITE_HYGIENE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours
const ACTIVATION_CODE_TTL_MS = 30 * 60 * 1000 // 30 minutes
// Alphabet sans caractères ambigus au téléphone (pas de 0/O, 1/I/L)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(length = 8): string {
  return Array.from({ length }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('')
}

const inviteSelect = {
  id: true,
  username: true,
  email: true,
  nom: true,
  proEmail: true,
  orgRole: true,
  isDeptHead: true,
  status: true,
  expiresAt: true,
  activationCodeExpiresAt: true,
  createdUserId: true,
  createdAt: true,
} as const

const ORG_ROLE_LABEL: Record<string, string> = { OWNER: 'Propriétaire', ADMIN: 'Administrateur', MEMBER: 'Membre' }

// Best-effort, comme les autres notifications système (voir helpers/thread.ts::notifyUser) :
// une invitation reste utilisable via les actions manuelles (Fichier/Code) même si
// l'org n'a pas encore de compte Resend connecté ou d'email de contact renseigné.
// Le lien porte directement le fileToken de l'invitation (déjà généré à sa création,
// voir schema.prisma) — ni plus ni moins secret que le fichier .jep, qui ne fait que
// l'emballer ; /resolve-by-token (publicUserInvites.ts) le résout côté navigateur.
async function sendInviteEmail(
  invite: { email: string; nom: string; fileToken: string; orgRole: string },
  organizationId: string,
  invitedByName: string
): Promise<boolean> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } })
  if (!org?.resendApiKeyEnc || !org.emailContact) return false

  try {
    const resend = buildResendClient(getDecryptedResendKey(org))
    const activationUrl = `${config.webmailUrl}/activate?token=${invite.fileToken}`
    const companyName = org.companyName || org.name
    await sendNotificationEmail(
      resend,
      org.emailContact,
      companyName,
      invite.email,
      `Invitation à rejoindre ${companyName}`,
      buildNotificationEmail(companyName, `Bienvenue, ${invite.nom}`, [
        { label: 'Invité par', value: invitedByName },
        { label: 'Rôle', value: ORG_ROLE_LABEL[invite.orgRole] ?? invite.orgRole },
        {
          label: 'Activation',
          value: `<a href="${activationUrl}" style="color:#0F70B7;font-weight:600;">Commencer l'activation →</a>`,
        },
      ])
    )
    return true
  } catch (e) {
    console.error('[INVITE-EMAIL]', (e as Error).message)
    return false
  }
}

router.get('/', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const invites = await db.userInvite.findMany({ select: inviteSelect, orderBy: { createdAt: 'desc' } })
  res.json(invites)
})

router.post('/', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { username: rawUsername, email: rawEmail, nom, proEmail, orgRole, isDeptHead } = req.body
  if (!rawUsername || !rawEmail || !nom) {
    return res.status(400).json({ error: 'username, email et nom sont requis.' })
  }
  const username = String(rawUsername).toLowerCase().trim()
  const email = String(rawEmail).toLowerCase().trim()

  try {
    // username/email sont uniques sur toute la plateforme (comme User) — vérifiés
    // ici en code plutôt que via une contrainte DB sur UserInvite, pour ne pas
    // bloquer définitivement un pseudo déjà révoqué/expiré (voir schema.prisma).
    const [existingUser, existingInviteByUsername, existingInviteByEmail] = await Promise.all([
      prisma.user.findFirst({ where: { OR: [{ username }, { email }] } }),
      prisma.userInvite.findFirst({ where: { username, status: 'PENDING' } }),
      prisma.userInvite.findFirst({ where: { email, status: 'PENDING' } }),
    ])
    if (existingUser || existingInviteByUsername || existingInviteByEmail) {
      return res.status(400).json({ error: "Nom d'utilisateur ou email déjà utilisé." })
    }

    const db = forOrg(req.user!.organizationId)
    const invite = await db.userInvite.create({
      data: {
        organizationId: req.user!.organizationId,
        username,
        email,
        nom,
        proEmail: proEmail || null,
        orgRole: orgRole === 'OWNER' || orgRole === 'ADMIN' ? orgRole : 'MEMBER',
        isDeptHead: !!isDeptHead,
        expiresAt: new Date(Date.now() + INVITE_HYGIENE_TTL_MS),
        createdById: req.user!.id,
      },
      select: { ...inviteSelect, fileToken: true },
    })

    const emailSent = await sendInviteEmail(invite, req.user!.organizationId, req.user!.nom ?? req.user!.username)

    const { fileToken: _fileToken, ...publicInvite } = invite
    res.status(201).json({ ...publicInvite, emailSent })
  } catch (e) {
    console.error('[POST /api/user-invites]', e)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

// Fichier téléchargeable : ne change jamais tant que l'invite existe (le
// fileToken est fixé à la création) — re-téléchargeable à volonté, sans effet
// de bord, indépendamment du code d'activation (voir POST /:id/activation-code).
router.get('/:id/file', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const invite = await db.userInvite.findFirst({ where: { id: req.params.id } })
  if (!invite) return res.status(404).json({ error: 'Invitation introuvable.' })

  const payload = JSON.stringify({ v: 1, token: invite.fileToken })
  const fileContent = `${INVITE_FILE_MAGIC}\n${encryptInviteFile(payload)}`

  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="activation-${invite.username}.jep"`)
  res.send(fileContent)
})

// Génère (ou régénère) le code d'activation — indépendant du fichier, rappelable
// à tout moment. Régénérer invalide immédiatement le précédent (nouveau hash).
// Le code n'apparaît en clair que dans CETTE réponse ; ne jamais le logger.
router.post('/:id/activation-code', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const invite = await db.userInvite.findFirst({ where: { id: req.params.id } })
  if (!invite) return res.status(404).json({ error: 'Invitation introuvable.' })
  if (invite.status !== 'PENDING') return res.status(400).json({ error: 'Cette invitation n\'est plus en attente.' })

  const code = generateCode()
  const activationCodeExpiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_MS)
  await db.userInvite.update({
    where: { id: invite.id },
    data: {
      activationCodeHash: await bcrypt.hash(code, 12),
      activationCodeExpiresAt,
      codeAttempts: 0,
    },
  })
  res.json({ code, expiresAt: activationCodeExpiresAt })
})

router.post('/:id/revoke', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const invite = await db.userInvite.findFirst({ where: { id: req.params.id } })
  if (!invite) return res.status(404).json({ error: 'Invitation introuvable.' })
  const updated = await db.userInvite.update({ where: { id: invite.id }, data: { status: 'REVOKED' }, select: inviteSelect })
  res.json(updated)
})

export default router
