import crypto from 'crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { forOrg } from '../middleware/scopedPrisma'
import { inviteFileUpload } from '../lib/upload'
import { decryptInviteFile, INVITE_FILE_MAGIC } from '../lib/inviteFileCrypto'
import { signToken } from '../lib/jwt'

const router = Router()

const ACTIVATION_TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes
const MAX_CODE_ATTEMPTS = 5

// Contrairement à /verify-code (verrou par invitation, cf. MAX_CODE_ATTEMPTS), ces routes
// publiques n'avaient aucune protection par IP — même limite que loginLimiter (routes/auth.ts).
const publicInviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
})

// Message générique volontaire : ne jamais distinguer "introuvable" / "expiré" /
// "révoqué" à un appelant non authentifié, pour ne rien laisser deviner.
const GENERIC_INVITE_ERROR = { error: "Ce fichier d'activation n'est plus valide." }

function extractFileToken(fileBuffer: Buffer): string | null {
  const text = fileBuffer.toString('utf8')
  const [magic, ...rest] = text.split('\n')
  if (magic !== INVITE_FILE_MAGIC) return null
  try {
    const payload = JSON.parse(decryptInviteFile(rest.join('\n').trim())) as { v?: number; token?: string }
    return typeof payload.token === 'string' ? payload.token : null
  } catch {
    return null
  }
}

async function loadPendingInviteByFileToken(fileToken: string) {
  const invite = await prisma.userInvite.findUnique({
    where: { fileToken },
    include: { organization: { select: { name: true, companyName: true } } },
  })
  if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) return null
  return invite
}

// Étape 1 : l'app uploade les octets du fichier tels quels — elle ne déchiffre
// jamais rien elle-même, seul ce endpoint (côté serveur) le fait.
router.post('/resolve', publicInviteLimiter, inviteFileUpload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) return res.status(400).json({ error: 'Fichier requis.' })

  const fileToken = extractFileToken(file.buffer)
  if (!fileToken) return res.status(400).json({ error: 'Fichier invalide.' })

  const invite = await loadPendingInviteByFileToken(fileToken)
  if (!invite) return res.status(404).json(GENERIC_INVITE_ERROR)

  res.json({ fileToken, organizationName: invite.organization.companyName || invite.organization.name })
})

// Variante de /resolve pour un lien reçu par email (voir routes/userInvites.ts
// ::sendInviteEmail) : le fileToken est directement porté par l'URL plutôt
// qu'emballé dans un fichier chiffré — ni plus ni moins secret, le fichier .jep
// n'ajoutait aucune entropie au-delà de ce même token. Même réponse que /resolve
// pour enchaîner sur la même étape 2 (code) côté front.
router.get('/resolve-by-token', publicInviteLimiter, async (req, res) => {
  const fileToken = typeof req.query.token === 'string' ? req.query.token : null
  if (!fileToken) return res.status(400).json({ error: 'Token requis.' })

  const invite = await loadPendingInviteByFileToken(fileToken)
  if (!invite) return res.status(404).json(GENERIC_INVITE_ERROR)

  res.json({ fileToken, organizationName: invite.organization.companyName || invite.organization.name })
})

// Étape 2 : code obtenu par l'utilisateur en contactant l'admin — indépendant du
// fichier, jamais utilisé pour déchiffrer quoi que ce soit, juste comparé côté serveur.
router.post('/verify-code', publicInviteLimiter, async (req, res) => {
  const { fileToken, code } = req.body
  if (!fileToken || !code) return res.status(400).json({ error: 'fileToken et code requis.' })

  const invite = await prisma.userInvite.findUnique({ where: { fileToken } })
  if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
    return res.status(404).json(GENERIC_INVITE_ERROR)
  }
  if (!invite.activationCodeHash || !invite.activationCodeExpiresAt || invite.activationCodeExpiresAt < new Date()) {
    return res.status(400).json({ error: 'Aucun code valide. Demandez-en un nouveau à votre administrateur.' })
  }

  const db = forOrg(invite.organizationId)
  const valid = await bcrypt.compare(String(code).toUpperCase().trim(), invite.activationCodeHash)
  if (!valid) {
    const attempts = invite.codeAttempts + 1
    if (attempts >= MAX_CODE_ATTEMPTS) {
      // Verrouillage : le code est invalidé, l'admin doit en générer un nouveau.
      await db.userInvite.update({ where: { id: invite.id }, data: { codeAttempts: attempts, activationCodeHash: null, activationCodeExpiresAt: null } })
    } else {
      await db.userInvite.update({ where: { id: invite.id }, data: { codeAttempts: attempts } })
    }
    return res.status(400).json({ error: 'Code incorrect.' })
  }

  // Usage unique : le code est consommé, remplacé par un token d'activation à
  // courte durée de vie pour l'étape finale. Entropie déjà maximale (32 octets
  // aléatoires) : hashé en SHA-256, pas bcrypt (inutile pour un secret à haute entropie).
  const activationToken = crypto.randomBytes(32).toString('base64url')
  const activationTokenHash = crypto.createHash('sha256').update(activationToken).digest('hex')
  const activationTokenExpiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS)
  await db.userInvite.update({
    where: { id: invite.id },
    data: {
      activationCodeHash: null,
      activationCodeExpiresAt: null,
      codeAttempts: 0,
      activationTokenHash,
      activationTokenExpiresAt,
    },
  })

  res.json({ activationToken, expiresAt: activationTokenExpiresAt })
})

// Étape 3 : crée le vrai User (jamais avant ce point), consomme l'invitation,
// renvoie une session — même forme que POST /api/auth/login.
router.post('/activate', publicInviteLimiter, async (req, res) => {
  const { fileToken, activationToken, password } = req.body
  if (!fileToken || !activationToken || !password) {
    return res.status(400).json({ error: 'fileToken, activationToken et password requis.' })
  }

  const invite = await prisma.userInvite.findUnique({ where: { fileToken } })
  if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
    return res.status(404).json(GENERIC_INVITE_ERROR)
  }
  if (!invite.activationTokenHash || !invite.activationTokenExpiresAt || invite.activationTokenExpiresAt < new Date()) {
    return res.status(400).json({ error: "Session d'activation expirée. Recommencez depuis la vérification du code." })
  }

  const providedHash = crypto.createHash('sha256').update(String(activationToken)).digest('hex')
  const providedBuf = Buffer.from(providedHash)
  const expectedBuf = Buffer.from(invite.activationTokenHash)
  const valid = providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf)
  if (!valid) return res.status(401).json({ error: 'Token invalide.' })

  try {
    const db = forOrg(invite.organizationId)
    const passwordHash = await bcrypt.hash(String(password), 12)

    const user = await db.$transaction(async tx => {
      const created = await tx.user.create({
        data: {
          organizationId: invite.organizationId,
          username: invite.username,
          email: invite.email,
          password: passwordHash,
          nom: invite.nom,
          proEmail: invite.proEmail,
          orgRole: invite.orgRole,
          isDeptHead: invite.isDeptHead,
        },
      })
      await tx.userInvite.update({
        where: { id: invite.id },
        data: {
          status: 'ACTIVATED',
          activatedAt: new Date(),
          createdUserId: created.id,
          activationTokenHash: null,
          activationTokenExpiresAt: null,
        },
      })

      // Config pré-staged par un import CSV de migration (voir routes/organizations.ts
      // POST /me/import) : appliquée seulement maintenant que le User existe réellement.
      // Create-only pour les règles de routage — ne jamais écraser une règle qu'un
      // admin aurait configurée manuellement pour ce canal entre-temps.
      const pendingCanaux: string[] = invite.pendingRoutingCanaux ? JSON.parse(invite.pendingRoutingCanaux) : []
      for (const canal of pendingCanaux) {
        const existingRule = await tx.threadRoutingRule.findFirst({ where: { canal } })
        if (!existingRule) {
          await tx.threadRoutingRule.create({ data: { organizationId: invite.organizationId, canal, assignToId: created.id, active: true } })
        }
      }

      const pendingSenders: string[] = invite.pendingSenderEmails ? JSON.parse(invite.pendingSenderEmails) : []
      for (const email of pendingSenders) {
        const existingGrant = await tx.senderGrant.findFirst({ where: { userId: created.id, email } })
        if (!existingGrant) {
          await tx.senderGrant.create({ data: { organizationId: invite.organizationId, userId: created.id, email, grantedBy: 'Migration (import CSV)' } })
        }
      }

      return created
    })

    const token = signToken(user)
    const { password: _password, ...userWithoutPassword } = user
    res.status(201).json({ token, user: userWithoutPassword })
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === 'P2002') return res.status(409).json({ error: "Ce nom d'utilisateur ou cet email est déjà utilisé." })
    console.error('[POST /api/public/user-invites/activate]', e)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

export default router
