import { Router } from 'express'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'

const router = Router()

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    const { canal } = req.query
    const where = canal ? { OR: [{ canal: canal as string }, { canal: null }] } : {}
    const templates = await db.replyTemplate.findMany({ where, orderBy: { titre: 'asc' } })
    res.json(templates)
  } catch (err) {
    console.error('[GET /api/reply-templates]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.post('/', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { titre, corps, canal } = req.body
    if (!titre?.trim() || !corps?.trim()) return res.status(400).json({ error: 'Titre et corps requis.' })
    const db = forOrg(req.user!.organizationId)
    const template = await db.replyTemplate.create({
      data: { organizationId: req.user!.organizationId, titre: titre.trim(), corps: corps.trim(), canal: canal || null },
    })
    res.json(template)
  } catch (err) {
    console.error('[POST /api/reply-templates]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.put('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { titre, corps, canal } = req.body
    if (!titre?.trim() || !corps?.trim()) return res.status(400).json({ error: 'Titre et corps requis.' })
    const db = forOrg(req.user!.organizationId)
    const template = await db.replyTemplate.update({
      where: { id: req.params.id },
      data: { titre: titre.trim(), corps: corps.trim(), canal: canal || null },
    })
    res.json(template)
  } catch {
    res.status(404).json({ error: 'Template introuvable.' })
  }
})

router.delete('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    await db.replyTemplate.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Template introuvable.' })
  }
})

export default router
