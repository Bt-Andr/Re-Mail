import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import prisma from '../lib/prisma'
import { canCreateOrgRole, canManageOrgUser, canSetOrgRole } from '../lib/orgPermissions'
import { hasPrismaErrorCode } from '../lib/prismaErrors'
import { parseRequest } from '../validation/request'
import { senderGrantCreateSchema, userCreateSchema, userUpdateSchema } from '../validation/schemas'

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
async function resolveSenderGrants(
  db: ReturnType<typeof forOrg>,
  emails: string[]
): Promise<{ wanted: string[]; invalid: string[] }> {
  const routes = await db.mailRoute.findMany({ where: { active: true }, select: { alias: true } })
  const valid = new Set(routes.map(route => route.alias.toLowerCase()))
  const wanted = [...new Set(emails.map(email => email.toLowerCase()))]
  return { wanted, invalid: wanted.filter(email => !valid.has(email)) }
}

async function syncSenderGrants(
  db: ReturnType<typeof forOrg>,
  organizationId: string,
  userId: string,
  wanted: string[],
  grantedBy: string
): Promise<void> {
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
  const input = parseRequest(userCreateSchema, req.body, res)
  if (!input) return
  const { username, nom, email, password, orgRole, proEmail, isDeptHead, grantedSenders } = input
  const requestedRole = orgRole ?? 'MEMBER'
  if (!canCreateOrgRole(req.user!.orgRole, requestedRole)) {
    return res.status(403).json({ error: "Vous ne pouvez pas créer un utilisateur avec ce rôle." })
  }

  const db = forOrg(req.user!.organizationId)
  const resolvedGrants = grantedSenders ? await resolveSenderGrants(db, grantedSenders) : null
  if (resolvedGrants?.invalid.length) {
    return res.status(400).json({ error: `Alias inconnu ou inactif : ${resolvedGrants.invalid[0]}.` })
  }

  try {
    const hash = await bcrypt.hash(password, 12)
    const user = await db.user.create({
      data: {
        organizationId: req.user!.organizationId,
        username,
        nom,
        email,
        password: hash,
        orgRole: requestedRole,
        proEmail: proEmail || null,
        isDeptHead: !!isDeptHead,
      },
      select: userSelect,
    })
    if (resolvedGrants?.wanted.length) {
      await syncSenderGrants(db, req.user!.organizationId, user.id, resolvedGrants.wanted, req.user!.nom || req.user!.username)
      const refreshed = await db.user.findUnique({ where: { id: user.id }, select: userSelect })
      return res.status(201).json(refreshed)
    }
    res.status(201).json(user)
  } catch (e) {
    if (hasPrismaErrorCode(e, 'P2002')) return res.status(409).json({ error: "Email ou nom d'utilisateur déjà utilisé." })
    throw e
  }
})

router.put('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const existing = await db.user.findUnique({ where: { id: req.params.id }, select: { id: true, orgRole: true } })
  if (!existing) return res.status(404).json({ error: 'Utilisateur introuvable.' })
  if (!canManageOrgUser(req.user!.orgRole, existing.orgRole)) {
    return res.status(403).json({ error: 'Vous ne pouvez pas modifier cet utilisateur.' })
  }

  const input = parseRequest(userUpdateSchema, req.body, res)
  if (!input) return
  const { nom, username, email, orgRole, proEmail, password, isDeptHead, grantedSenders } = input
  if (existing.orgRole === 'OWNER' && orgRole && orgRole !== 'OWNER') {
    return res.status(409).json({ error: "Transférez d'abord la propriété de l'organisation." })
  }
  if (orgRole && orgRole !== existing.orgRole && !canSetOrgRole(req.user!.orgRole, existing.orgRole, orgRole)) {
    return res.status(403).json({ error: 'Vous ne pouvez pas attribuer ce rôle.' })
  }
  const resolvedGrants = grantedSenders ? await resolveSenderGrants(db, grantedSenders) : null
  if (resolvedGrants?.invalid.length) {
    return res.status(400).json({ error: `Alias inconnu ou inactif : ${resolvedGrants.invalid[0]}.` })
  }
  const data: Record<string, unknown> = {}
  if (nom) data.nom = nom
  if (username) data.username = username
  if (email) data.email = email
  if (orgRole) data.orgRole = orgRole
  if (proEmail !== undefined) data.proEmail = proEmail || null
  if (isDeptHead !== undefined) data.isDeptHead = isDeptHead
  if (password) {
    data.password = await bcrypt.hash(password, 12)
    data.sessionVersion = { increment: 1 }
  }

  try {
    await db.user.update({ where: { id: existing.id }, data, select: { id: true } })
    if (resolvedGrants) {
      await syncSenderGrants(db, req.user!.organizationId, existing.id, resolvedGrants.wanted, req.user!.nom || req.user!.username)
    }
    const user = await db.user.findUnique({ where: { id: existing.id }, select: userSelect })
    res.json(user)
  } catch (e) {
    if (hasPrismaErrorCode(e, 'P2002')) return res.status(409).json({ error: "Email ou nom d'utilisateur déjà utilisé." })
    throw e
  }
})

router.post('/:id/sender-grants', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const input = parseRequest(senderGrantCreateSchema, req.body, res)
  if (!input) return
  const { email } = input
  const db = forOrg(req.user!.organizationId)
  const targetUser = await db.user.findUnique({ where: { id: req.params.id }, select: { id: true, orgRole: true } })
  if (!targetUser) return res.status(404).json({ error: 'Utilisateur introuvable.' })
  if (!canManageOrgUser(req.user!.orgRole, targetUser.orgRole)) {
    return res.status(403).json({ error: 'Vous ne pouvez pas modifier cet utilisateur.' })
  }
  if (targetUser.orgRole !== 'MEMBER') {
    return res.status(400).json({ error: "Les propriétaires et administrateurs ont déjà accès à toutes les adresses." })
  }
  const route = await db.mailRoute.findFirst({ where: { alias: email, active: true } })
  if (!route) return res.status(400).json({ error: "Cet alias n'existe pas ou est inactif." })

  const existingGrant = await db.senderGrant.findFirst({ where: { userId: targetUser.id, email } })
  const grant = existingGrant ?? (await db.senderGrant.create({
    data: { organizationId: req.user!.organizationId, userId: targetUser.id, email, grantedBy: req.user!.nom || req.user!.username },
  }))
  res.status(201).json(grant)
})

router.delete('/:id/sender-grants/:grantId', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const targetUser = await db.user.findUnique({ where: { id: req.params.id }, select: { orgRole: true } })
  if (!targetUser) return res.status(404).json({ error: 'Utilisateur introuvable.' })
  if (!canManageOrgUser(req.user!.orgRole, targetUser.orgRole)) {
    return res.status(403).json({ error: 'Vous ne pouvez pas modifier cet utilisateur.' })
  }
  const grant = await db.senderGrant.findUnique({ where: { id: req.params.grantId } })
  if (!grant || grant.userId !== req.params.id) return res.status(404).json({ error: 'Autorisation introuvable.' })
  await db.senderGrant.delete({ where: { id: grant.id } })
  res.json({ success: true })
})

router.delete('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  if (req.params.id === req.user!.id)
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte.' })
  const db = forOrg(req.user!.organizationId)
  const existing = await db.user.findUnique({ where: { id: req.params.id }, select: { id: true, orgRole: true } })
  if (!existing) return res.status(404).json({ error: 'Utilisateur introuvable.' })
  if (!canManageOrgUser(req.user!.orgRole, existing.orgRole)) {
    return res.status(403).json({ error: 'Vous ne pouvez pas supprimer cet utilisateur.' })
  }
  if (existing.orgRole === 'OWNER') {
    return res.status(409).json({ error: "Transférez d'abord la propriété de l'organisation." })
  }
  try {
    await db.user.delete({ where: { id: existing.id } })
    res.json({ ok: true })
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2003')) {
      return res.status(409).json({ error: 'Cet utilisateur est encore référencé et ne peut pas être supprimé.' })
    }
    throw error
  }
})

class OwnershipTransferError extends Error {
  constructor(readonly reason: 'target_not_found' | 'same_user' | 'already_owner' | 'actor_not_owner') {
    super(reason)
  }
}

router.post('/:id/transfer-ownership', authenticateToken, requireOrgRole(['OWNER']), async (req, res) => {
  const organizationId = req.user!.organizationId
  const actorId = req.user!.id
  const targetId = req.params.id

  if (targetId === actorId) return res.status(400).json({ error: 'Choisissez un autre utilisateur.' })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const owner = await prisma.$transaction(
        async tx => {
          const target = await tx.user.findFirst({
            where: { id: targetId, organizationId },
            select: { id: true, orgRole: true },
          })
          if (!target) throw new OwnershipTransferError('target_not_found')
          if (target.orgRole === 'OWNER') throw new OwnershipTransferError('already_owner')

          // Cette écriture conditionnelle sérialise deux transferts concurrents du
          // même propriétaire : un seul peut faire passer OWNER -> ADMIN.
          const demoted = await tx.user.updateMany({
            where: { id: actorId, organizationId, orgRole: 'OWNER' },
            data: { orgRole: 'ADMIN' },
          })
          if (demoted.count !== 1) throw new OwnershipTransferError('actor_not_owner')

          return tx.user.update({ where: { id: target.id }, data: { orgRole: 'OWNER' }, select: userSelect })
        },
        { isolationLevel: 'Serializable' }
      )

      return res.json({ previousOwnerId: actorId, owner })
    } catch (error) {
      if (error instanceof OwnershipTransferError) {
        if (error.reason === 'target_not_found') return res.status(404).json({ error: 'Utilisateur introuvable.' })
        if (error.reason === 'already_owner') return res.status(409).json({ error: 'Cet utilisateur est déjà propriétaire.' })
        return res.status(409).json({ error: "La propriété de l'organisation a déjà changé." })
      }
      if (hasPrismaErrorCode(error, 'P2034') && attempt < 2) continue
      throw error
    }
  }
})

export default router
