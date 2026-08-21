import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { authenticateToken } from '../middleware/auth'
import { signToken } from '../lib/jwt'
import { createOrgAndOwner } from '../lib/personalAccountFactory'
import { consumeLoginHandoff } from '../lib/loginHandoff'

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

// Crée une organisation + son premier utilisateur (OWNER) en une seule étape —
// pattern "créez votre espace" volontairement simple pour la v1 (un utilisateur
// appartient à une seule organisation, pas d'invitation multi-org).
//
// accountType 'perso' : même mécanisme, mais l'Organization créée est marquée
// isPersonal (une "org à un seul membre", jamais montrée comme telle côté produit —
// voir CLAUDE.md) et orgName n'est pas requis, son nom interne est dérivé de nom/email.
router.post('/signup', signupLimiter, async (req, res) => {
  const { orgName, username, email, password, nom } = req.body
  const isPersonal = req.body.accountType === 'perso'
  if (!isPersonal && !orgName) {
    return res.status(400).json({ error: 'Champs requis manquants.' })
  }
  if (!username || !email || !password || !nom) {
    return res.status(400).json({ error: 'Champs requis manquants.' })
  }

  try {
    const normalizedEmail = email.toLowerCase().trim()
    // email n'est plus une contrainte d'unicité en base (schema.prisma — nécessaire
    // pour que Google/IMAP signin puisse créer un compte perso même quand cet email
    // sert déjà de contact à un compte d'organisation ailleurs, voir gmailOAuth.ts).
    // L'inscription classique garde volontairement ce contrôle, global et inchangé :
    // ce n'est pas le comportement visé par ce changement, juste une contrainte DB en
    // moins à recréer en code (même motif que userInvites.ts:103).
    if (await prisma.user.findFirst({ where: { email: normalizedEmail } })) {
      return res.status(409).json({ error: "Ce nom d'utilisateur ou cet email est déjà utilisé." })
    }

    const orgNameToUse = isPersonal ? nom || email.split('@')[0] : orgName
    const passwordHash = await bcrypt.hash(password, 12)

    const result = await createOrgAndOwner({
      orgName: orgNameToUse,
      isPersonal,
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
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
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis.' })

  try {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
      include: { organization: { select: { id: true, name: true, slug: true, isPersonal: true, _count: { select: { users: true } } } } },
    })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Identifiants incorrects.' })
    }

    const token = signToken(user)
    const { password: _password, organization, ...userWithoutPassword } = user
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

// Étape finale du flux "se connecter avec Google" (routes/gmailOAuth.ts, intent
// 'signin') : échange le jeton d'échange à usage unique posé par la redirection OAuth
// (jamais le vrai JWT dans une URL) contre une vraie session — même mécanisme que
// /login, juste une preuve d'identité différente (jeton signé par le callback plutôt
// qu'un mot de passe). Réponse alignée sur /signup (avec `organization`), PAS sur /login
// (qui l'omet) : cet endpoint sert aussi bien un compte tout juste créé qu'un compte
// existant, donc doit toujours renvoyer une organisation à jour (sinon
// useSession().organization resterait périmé jusqu'au prochain /auth/me).
router.post('/google/exchange', googleExchangeLimiter, async (req, res) => {
  const { handoff } = req.body
  if (!handoff || typeof handoff !== 'string') return res.status(400).json({ error: 'Jeton manquant.' })

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
