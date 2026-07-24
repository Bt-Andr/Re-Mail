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
router.put('/:canal', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { canal } = req.params
  const { assignToId, active } = req.body
  if (!assignToId) return res.status(400).json({ error: 'assignToId requis.' })
  try {
    const db = forOrg(req.user!.organizationId)
    const existing = await db.threadRoutingRule.findFirst({ where: { canal } })
    const include = { assignTo: { select: { id: true, nom: true, username: true, orgRole: true } } } as const
    const rule = existing
      ? await db.threadRoutingRule.update({
          where: { id: existing.id },
          data: { assignToId, ...(active !== undefined ? { active } : {}) },
          include,
        })
      : await db.threadRoutingRule.create({ data: { organizationId: req.user!.organizationId, canal, assignToId, active: active ?? true }, include })
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
