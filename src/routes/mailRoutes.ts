import { Router } from 'express'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'

const router = Router()

router.get('/', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const routes = await db.mailRoute.findMany({ orderBy: { alias: 'asc' } })
  res.json(routes)
})

router.post('/', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { alias, personalEmail, displayName, active } = req.body
  // personalEmail est optionnel : l'alias reçoit déjà ses emails comme threads dans
  // l'inbox sans lui — il ne sert qu'au transfert vers une boîte perso, ajoutable plus tard.
  if (!alias) return res.status(400).json({ error: 'alias requis.' })
  try {
    const db = forOrg(req.user!.organizationId)
    const route = await db.mailRoute.create({
      data: {
        organizationId: req.user!.organizationId,
        alias: alias.toLowerCase().trim(),
        personalEmail: personalEmail?.trim() || '',
        displayName: displayName?.trim() || null,
        active: active ?? true,
      },
    })
    res.status(201).json(route)
  } catch {
    res.status(409).json({ error: 'Cet alias existe déjà.' })
  }
})

// Import en masse : priorité à la configuration des alias, le transfert personnel
// (personalEmail) est optionnel et peut être complété plus tard via l'édition.
router.post('/bulk', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { routes } = req.body
  if (!Array.isArray(routes) || routes.length === 0) return res.status(400).json({ error: 'routes requis.' })
  if (routes.length > 200) return res.status(400).json({ error: '200 adresses maximum par import.' })

  const db = forOrg(req.user!.organizationId)
  const created: unknown[] = []
  const skipped: { alias: string; reason: string }[] = []
  const seen = new Set<string>()

  for (const raw of routes) {
    const alias = typeof raw?.alias === 'string' ? raw.alias.toLowerCase().trim() : ''
    const personalEmail = typeof raw?.personalEmail === 'string' ? raw.personalEmail.trim() : ''
    const displayName = typeof raw?.displayName === 'string' ? raw.displayName.trim() : ''

    if (!alias) {
      skipped.push({ alias: alias || '(vide)', reason: 'alias manquant' })
      continue
    }
    if (seen.has(alias)) {
      skipped.push({ alias, reason: 'doublon dans la liste importée' })
      continue
    }
    seen.add(alias)

    const existing = await db.mailRoute.findFirst({ where: { alias } })
    if (existing) {
      skipped.push({ alias, reason: 'existe déjà' })
      continue
    }

    try {
      const route = await db.mailRoute.create({
        data: { organizationId: req.user!.organizationId, alias, personalEmail, displayName: displayName || null, active: true },
      })
      created.push(route)
    } catch {
      skipped.push({ alias, reason: 'erreur lors de la création' })
    }
  }

  res.json({ created, skipped })
})

router.put('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { alias, personalEmail, displayName, active } = req.body
  try {
    const db = forOrg(req.user!.organizationId)
    const route = await db.mailRoute.update({
      where: { id: req.params.id },
      data: {
        alias: alias?.toLowerCase().trim(),
        personalEmail: personalEmail?.trim(),
        displayName: displayName?.trim() || null,
        active,
      },
    })
    res.json(route)
  } catch {
    res.status(404).json({ error: 'Route introuvable.' })
  }
})

router.delete('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    await db.mailRoute.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Route introuvable.' })
  }
})

export default router
