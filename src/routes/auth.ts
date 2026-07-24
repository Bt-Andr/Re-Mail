import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { authenticateToken } from '../middleware/auth'
import { signToken } from '../lib/jwt'

const router = Router()

// Supprime les diacritiques (accents) après normalisation NFD, ex. "é" -> "e"
const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", 'g')

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(COMBINING_DIACRITICS, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'org'
  )
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let attempt = 0
  while (await prisma.organization.findUnique({ where: { slug } })) {
    attempt += 1
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
    if (attempt > 10) throw new Error('Impossible de générer un identifiant unique.')
  }
  return slug
}

// Crée une organisation + son premier utilisateur (OWNER) en une seule étape —
// pattern "créez votre espace" volontairement simple pour la v1 (un utilisateur
// appartient à une seule organisation, pas d'invitation multi-org).
router.post('/signup', async (req, res) => {
  const { orgName, username, email, password, nom } = req.body
  if (!orgName || !username || !email || !password || !nom) {
    return res.status(400).json({ error: 'Champs requis manquants.' })
  }

  try {
    const slug = await uniqueSlug(slugify(orgName))
    const hash = await bcrypt.hash(password, 12)

    const result = await prisma.$transaction(async tx => {
      const organization = await tx.organization.create({
        data: { name: orgName.trim(), slug },
      })
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          username: username.toLowerCase().trim(),
          email: email.toLowerCase().trim(),
          password: hash,
          nom,
          orgRole: 'OWNER',
        },
      })
      return { organization, user }
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
      organization: { id: result.organization.id, name: result.organization.name, slug: result.organization.slug },
    })
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === 'P2002') return res.status(409).json({ error: "Ce nom d'utilisateur ou cet email est déjà utilisé." })
    console.error('[POST /api/auth/signup]', e)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis.' })

  try {
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase().trim() } })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Identifiants incorrects.' })
    }

    const token = signToken(user)
    const { password: _password, ...userWithoutPassword } = user
    res.json({ token, user: userWithoutPassword })
  } catch (e) {
    console.error('[POST /api/auth/login]', e)
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
        organization: { select: { id: true, name: true, slug: true } },
      },
    })
    if (!user) return res.status(401).json({ error: 'Session invalide.' })
    res.json({ user })
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

export default router
