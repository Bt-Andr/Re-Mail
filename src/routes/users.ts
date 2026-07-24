import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'

const router = Router()

const userSelect = {
  id: true,
  username: true,
  nom: true,
  email: true,
  orgRole: true,
  proEmail: true,
  isDeptHead: true,
  createdAt: true,
  senderGrants: { select: { id: true, email: true } },
} as const

// Remplace les autorisations d'envoi d'un utilisateur : uniquement des alias
// (MailRoute) actifs de SON organisation — contrairement à la référence
// jeprogroup-website (liste fixe d'adresses de service), les alias disponibles
// varient par organisation.
async function syncSenderGrants(db: ReturnType<typeof forOrg>, organizationId: string, userId: string, emails: unknown, grantedBy: string): Promise<void> {
  if (!Array.isArray(emails)) return
  const routes = await db.mailRoute.findMany({ where: { active: true }, select: { alias: true } })
  const valid = routes.map(r => r.alias.toLowerCase())
  const wanted = [...new Set(
    emails
      .filter((e): e is string => typeof e === 'string')
      .map(e => e.toLowerCase().trim())
      .filter(e => valid.includes(e))
  )]
  await db.senderGrant.deleteMany({ where: { userId, email: { notIn: wanted } } })
  for (const email of wanted) {
    const existing = await db.senderGrant.findFirst({ where: { userId, email } })
    if (!existing) await db.senderGrant.create({ data: { organizationId, userId, email, grantedBy } })
  }
}

router.get('/', authenticateToken, async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const users = await db.user.findMany({ select: userSelect, orderBy: { createdAt: 'asc' } })
  res.json(users)
})

router.post('/', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { username, nom, email, password, orgRole, proEmail, isDeptHead, grantedSenders } = req.body
  if (!username || !nom || !email || !password)
    return res.status(400).json({ error: 'Champs requis manquants' })

  try {
    const db = forOrg(req.user!.organizationId)
    const hash = await bcrypt.hash(password, 12)
    const user = await db.user.create({
      data: {
        organizationId: req.user!.organizationId,
        username: username.toLowerCase().trim(),
        nom,
        email,
        password: hash,
        orgRole: orgRole === 'OWNER' || orgRole === 'ADMIN' ? orgRole : 'MEMBER',
        proEmail: proEmail || null,
        isDeptHead: !!isDeptHead,
      },
      select: userSelect,
    })
    if (Array.isArray(grantedSenders) && grantedSenders.length) {
      await syncSenderGrants(db, req.user!.organizationId, user.id, grantedSenders, req.user!.nom || req.user!.username)
      const refreshed = await db.user.findUnique({ where: { id: user.id }, select: userSelect })
      return res.json(refreshed)
    }
    res.json(user)
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === 'P2002') return res.status(400).json({ error: "Email ou nom d'utilisateur déjà utilisé" })
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.put('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { nom, username, email, orgRole, proEmail, password, isDeptHead } = req.body
  const data: Record<string, unknown> = {}
  if (nom) data.nom = nom
  if (username) data.username = (username as string).toLowerCase().trim()
  if (email) data.email = email
  if (orgRole === 'OWNER' || orgRole === 'ADMIN' || orgRole === 'MEMBER') data.orgRole = orgRole
  if ('proEmail' in req.body) data.proEmail = proEmail || null
  if ('isDeptHead' in req.body) data.isDeptHead = !!isDeptHead
  if (password) data.password = await bcrypt.hash(password, 12)

  try {
    const db = forOrg(req.user!.organizationId)
    await db.user.update({ where: { id: req.params.id }, data, select: { id: true } })
    if ('grantedSenders' in req.body) {
      await syncSenderGrants(db, req.user!.organizationId, req.params.id, req.body.grantedSenders, req.user!.nom || req.user!.username)
    }
    const user = await db.user.findUnique({ where: { id: req.params.id }, select: userSelect })
    res.json(user)
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === 'P2002') return res.status(400).json({ error: "Email ou nom d'utilisateur déjà utilisé" })
    res.status(404).json({ error: 'Utilisateur non trouvé' })
  }
})

router.post('/:id/sender-grants', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : ''
  if (!email) return res.status(400).json({ error: 'email requis.' })
  try {
    const db = forOrg(req.user!.organizationId)
    const route = await db.mailRoute.findFirst({ where: { alias: email, active: true } })
    if (!route) return res.status(400).json({ error: "Cet alias n'existe pas ou est inactif." })

    const existing = await db.senderGrant.findFirst({ where: { userId: req.params.id, email } })
    const grant = existing ?? (await db.senderGrant.create({
      data: { organizationId: req.user!.organizationId, userId: req.params.id, email, grantedBy: req.user!.nom || req.user!.username },
    }))
    res.status(201).json(grant)
  } catch {
    res.status(404).json({ error: 'Utilisateur introuvable.' })
  }
})

router.delete('/:id/sender-grants/:grantId', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const grant = await db.senderGrant.findUnique({ where: { id: req.params.grantId } })
  if (!grant || grant.userId !== req.params.id) return res.status(404).json({ error: 'Autorisation introuvable.' })
  await db.senderGrant.delete({ where: { id: grant.id } })
  res.json({ success: true })
})

router.delete('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  if (req.params.id === req.user!.id)
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' })
  try {
    const db = forOrg(req.user!.organizationId)
    await db.user.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Utilisateur non trouvé' })
  }
})

export default router
