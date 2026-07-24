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
  if (!alias || !personalEmail) return res.status(400).json({ error: 'alias et personalEmail requis.' })
  try {
    const db = forOrg(req.user!.organizationId)
    const route = await db.mailRoute.create({
      data: {
        organizationId: req.user!.organizationId,
        alias: alias.toLowerCase().trim(),
        personalEmail: personalEmail.trim(),
        displayName: displayName?.trim() || null,
        active: active ?? true,
      },
    })
    res.status(201).json(route)
  } catch {
    res.status(409).json({ error: 'Cet alias existe déjà.' })
  }
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
