import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import config from '../config'
import { authenticateToken } from '../middleware/auth'
import { signToken } from '../lib/jwt'
import { createOrgAndOwner } from '../lib/personalAccountFactory'
import { consumeLoginHandoff } from '../lib/loginHandoff'
import { buildResendClient } from '../lib/resendClient'
import { buildNotificationEmail, sendNotificationEmail } from '../lib/email'
import { parseRequest } from '../validation/request'
import {
  changePasswordSchema,
  googleExchangeSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  signupSchema,
} from '../validation/schemas'

const router = Router()

// Ni /login ni /signup n'avaient de protection brute-force (juste bcrypt.compare) —
// limite par IP en attendant un éventuel lockout par compte plus fin.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
})

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez plus tard.' },
})

const googleExchangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
})

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez plus tard.' },
})

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000
const GENERIC_RESET_RESPONSE = {
  ok: true,
  message: 'Si ce compte existe, un lien de réinitialisation a été envoyé.',
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

class InvalidResetTokenError extends Error {}

// Crée une organisation + son premier utilisateur (OWNER) en une seule étape —
// pattern "créez votre espace" volontairement simple pour la v1 (un utilisateur
// appartient à une seule organisation, pas d'invitation multi-org).
//
// accountType 'perso' : même mécanisme, mais l'Organization créée est marquée
// isPersonal (une "org à un seul membre", jamais montrée comme telle côté produit —
// voir CLAUDE.md) et orgName n'est pas requis, son nom interne est dérivé de nom/email.
router.post('/signup', signupLimiter, async (req, res) => {
  const input = parseRequest(signupSchema, req.body, res)
  if (!input) return
  const { orgName, username, email, password, nom, accountType } = input
  const isPersonal = accountType === 'perso'

  try {
    const normalizedEmail = email
    // email n'est plus une contrainte d'unicité en base (schema.prisma — nécessaire
    // pour que Google/IMAP signin puisse créer un compte perso même quand cet email
    // sert déjà de contact à un compte d'organisation ailleurs, voir gmailOAuth.ts).
    // L'inscription classique garde volontairement ce contrôle, global et inchangé :
    // ce n'est pas le comportement visé par ce changement, juste une contrainte DB en
    // moins à recréer en code (même motif que userInvites.ts:103).
    if (await prisma.user.findFirst({ where: { email: normalizedEmail } })) {
      return res.status(409).json({ error: "Ce nom d'utilisateur ou cet email est déjà utilisé." })
    }

    const orgNameToUse = isPersonal ? nom : orgName!
    const passwordHash = await bcrypt.hash(password, 12)

    const result = await createOrgAndOwner({
      orgName: orgNameToUse,
      isPersonal,
      username,
      email,
      passwordHash,
      nom,
    })

    const token = signToken({
      id: result.user.id,
      organizationId: result.organization.id,
      username: result.user.username,
      orgRole: result.user.orgRole,
      nom: result.user.nom,
    })

    res.status(201).json({
      token,
      user: { id: result.user.id, username: result.user.username, nom: result.user.nom, email: result.user.email, orgRole: result.user.orgRole },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        isPersonal: result.organization.isPersonal,
        memberCount: 1,
      },
    })
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === 'P2002') return res.status(409).json({ error: "Ce nom d'utilisateur ou cet email est déjà utilisé." })
    console.error('[POST /api/auth/signup]', e)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

// Renvoie `organization` (comme /signup et /google/exchange) — nécessaire côté client
// pour savoir si cette connexion doit remplacer l'identité personnelle ou s'ajouter
// comme une connexion d'organisation additive (isPersonal), voir SessionContext côté
// webmail/mobile.
router.post('/login', loginLimiter, async (req, res) => {
  const input = parseRequest(loginSchema, req.body, res)
  if (!input) return
  const { username, password } = input

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { organization: { select: { id: true, name: true, slug: true, isPersonal: true, _count: { select: { users: true } } } } },
    })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Identifiants incorrects.' })
    }

    const token = signToken(user)
    const { password: _password, sessionVersion: _sessionVersion, organization, ...userWithoutPassword } = user
    res.json({
      token,
      user: userWithoutPassword,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        isPersonal: organization.isPersonal,
        memberCount: organization._count.users,
      },
    })
  } catch (e) {
    console.error('[POST /api/auth/login]', e)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.post('/change-password', authenticateToken, async (req, res) => {
  const input = parseRequest(changePasswordSchema, req.body, res)
  if (!input) return

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
  if (!user || !(await bcrypt.compare(input.currentPassword, user.password))) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect.' })
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(input.newPassword, 12), sessionVersion: { increment: 1 } },
    select: { id: true, organizationId: true, username: true, orgRole: true, nom: true, sessionVersion: true },
  })
  res.json({ ok: true, token: signToken(updated) })
})

router.post('/password-reset/request', passwordResetLimiter, async (req, res) => {
  const input = parseRequest(passwordResetRequestSchema, req.body, res)
  if (!input) return

  // Réponse volontairement identique que le compte existe ou non. L'email système
  // est optionnel en local, mais doit être configuré en production pour délivrer le lien.
  if (!config.systemResendApiKey || !config.systemEmailFrom) return res.status(202).json(GENERIC_RESET_RESPONSE)

  try {
    const user = await prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true, email: true, nom: true },
    })
    if (user) {
      const token = crypto.randomBytes(32).toString('base64url')
      const tokenHash = hashResetToken(token)
      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: new Date() },
        }),
        prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
        }),
      ])

      const resetUrl = `${config.webmailUrl}/reset-password?token=${encodeURIComponent(token)}`
      await sendNotificationEmail(
        buildResendClient(config.systemResendApiKey),
        config.systemEmailFrom,
        'Re-Mail',
        user.email,
        'Réinitialisation de votre mot de passe Re-Mail',
        buildNotificationEmail('Re-Mail', 'Réinitialiser votre mot de passe', [
          { label: 'Compte', value: input.username },
          { label: 'Validité', value: '30 minutes' },
          { label: 'Action', link: { href: resetUrl, text: 'Choisir un nouveau mot de passe' } },
        ])
      )
    }
  } catch (error) {
    // Ne jamais transformer une panne fournisseur en oracle d'existence de compte.
    console.error('[POST /api/auth/password-reset/request]', error)
  }

  res.status(202).json(GENERIC_RESET_RESPONSE)
})

router.post('/password-reset/confirm', passwordResetLimiter, async (req, res) => {
  const input = parseRequest(passwordResetConfirmSchema, req.body, res)
  if (!input) return
  const now = new Date()
  const passwordHash = await bcrypt.hash(input.newPassword, 12)

  try {
    await prisma.$transaction(async tx => {
      const reset = await tx.passwordResetToken.findUnique({
        where: { tokenHash: hashResetToken(input.token) },
        select: { id: true, userId: true },
      })
      if (!reset) throw new InvalidResetTokenError()

      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: reset.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      })
      if (consumed.count !== 1) throw new InvalidResetTokenError()

      await tx.user.update({
        where: { id: reset.userId },
        data: { password: passwordHash, sessionVersion: { increment: 1 } },
      })
      await tx.passwordResetToken.updateMany({
        where: { userId: reset.userId, consumedAt: null },
        data: { consumedAt: now },
      })
    })
  } catch (error) {
    if (error instanceof InvalidResetTokenError) {
      return res.status(400).json({ error: 'Ce lien de réinitialisation est invalide ou expiré.' })
    }
    throw error
  }

  res.json({ ok: true })
})

// Étape finale du flux "se connecter avec Google" (routes/gmailOAuth.ts, intent
// 'signin') : échange le jeton d'échange à usage unique posé par la redirection OAuth
// (jamais le vrai JWT dans une URL) contre une vraie session — même mécanisme que
// /login, juste une preuve d'identité différente (jeton signé par le callback plutôt
// qu'un mot de passe). Réponse alignée sur /signup (avec `organization`), PAS sur /login
// (qui l'omet) : cet endpoint sert aussi bien un compte tout juste créé qu'un compte
// existant, donc doit toujours renvoyer une organisation à jour (sinon
// useSession().organization resterait périmé jusqu'au prochain /auth/me).
router.post('/google/exchange', googleExchangeLimiter, async (req, res) => {
  const input = parseRequest(googleExchangeSchema, req.body, res)
  if (!input) return
  const { handoff } = input

  try {
    const userId = await consumeLoginHandoff(handoff)
    if (!userId) return res.status(401).json({ error: 'Cette session de connexion a expiré, réessayez.' })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { select: { id: true, name: true, slug: true, isPersonal: true, _count: { select: { users: true } } } } },
    })
    if (!user) return res.status(401).json({ error: 'Compte introuvable.' })

    const token = signToken(user)
    res.json({
      token,
      user: { id: user.id, username: user.username, nom: user.nom, email: user.email, orgRole: user.orgRole },
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        isPersonal: user.organization.isPersonal,
        memberCount: user.organization._count.users,
      },
    })
  } catch (e) {
    console.error('[POST /api/auth/google/exchange]', e)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        nom: true,
        email: true,
        proEmail: true,
        orgRole: true,
        isDeptHead: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            isPersonal: true,
            _count: { select: { users: true } },
          },
        },
      },
    })
    if (!user) return res.status(401).json({ error: 'Session invalide.' })
    const { organization, ...rest } = user
    res.json({
      user: {
        ...rest,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          isPersonal: organization.isPersonal,
          memberCount: organization._count.users,
        },
      },
    })
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

export default router
