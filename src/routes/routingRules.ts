import { Router } from 'express'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'

const router = Router()

router.get('/', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (_req, res) => {
  try {
    const db = forOrg(_req.user!.organizationId)
    const rules = await db.threadRoutingRule.findMany({
      orderBy: { canal: 'asc' },
      include: { assignTo: { select: { id: true, nom: true, username: true, orgRole: true } } },
    })
    res.json(rules)
  } catch (err) {
    console.error('[GET /api/thread-routing-rules]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

// Upsert manuel par `canal` : dans ce schéma multi-tenant, `canal` n'est unique
// qu'en combinaison avec organizationId ([organizationId, canal]) — Prisma exige
// pour where/upsert soit un champ réellement unique seul, soit la clé composite
// littérale `organizationId_canal`. On évite cette subtilité en passant par `id`
// (globalement unique) pour l'update, après un findFirst scopé par canal.
//
// assignToId (existant) reste pour assigner directement à un membre déjà connu.
// assignToEmail (nouveau, adresse pro — voir routes/proAddresses.ts) accepte aussi un
// email sans compte : résout un User existant par email, sinon met en attente sur un
// UserInvite PENDING existant (même schéma que l'import CSV, organizations.ts:306-339)
// — aucune ThreadRoutingRule n'est créée tant que le compte n'existe pas réellement
// (assignToId est une FK non-nullable), elle le sera à l'activation de l'invitation
// (publicUserInvites.ts:185-192, déjà en place, non modifié).
router.put('/:canal', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { canal } = req.params
  const { assignToId, assignToEmail, active } = req.body
  if (!assignToId && !assignToEmail) return res.status(400).json({ error: 'assignToId ou assignToEmail requis.' })
  try {
    const db = forOrg(req.user!.organizationId)
    const include = { assignTo: { select: { id: true, nom: true, username: true, orgRole: true } } } as const

    let resolvedAssignToId: string = assignToId
    if (!resolvedAssignToId) {
      const email = String(assignToEmail).toLowerCase().trim()
      const user = await db.user.findFirst({ where: { email } })
      if (user) {
        resolvedAssignToId = user.id
      } else {
        const invite = await db.userInvite.findFirst({ where: { email, status: 'PENDING' } })
        if (!invite) {
          return res.status(404).json({ error: "Aucun compte ni invitation en attente pour cet email — créez d'abord une invitation." })
        }
        const canaux = new Set<string>(invite.pendingRoutingCanaux ? JSON.parse(invite.pendingRoutingCanaux) : [])
        canaux.add(canal)
        await db.userInvite.update({ where: { id: invite.id }, data: { pendingRoutingCanaux: JSON.stringify([...canaux]) } })
        return res.json({ staged: true, canal, invite: { id: invite.id, email: invite.email, nom: invite.nom } })
      }
    }

    const existing = await db.threadRoutingRule.findFirst({ where: { canal } })
    const rule = existing
      ? await db.threadRoutingRule.update({
          where: { id: existing.id },
          data: { assignToId: resolvedAssignToId, ...(active !== undefined ? { active } : {}) },
          include,
        })
      : await db.threadRoutingRule.create({
          data: { organizationId: req.user!.organizationId, canal, assignToId: resolvedAssignToId, active: active ?? true },
          include,
        })
    res.json(rule)
  } catch (err) {
    console.error('[PUT /api/thread-routing-rules]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.delete('/:canal', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    const existing = await db.threadRoutingRule.findFirst({ where: { canal: req.params.canal } })
    if (!existing) return res.status(404).json({ error: 'Règle introuvable.' })
    await db.threadRoutingRule.delete({ where: { id: existing.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Règle introuvable.' })
  }
})

export default router
