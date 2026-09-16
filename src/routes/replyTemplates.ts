import { Router } from 'express'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import { parseRequest } from '../validation/request'
import { replyTemplateQuerySchema, replyTemplateWriteSchema } from '../validation/schemas'

const router = Router()

router.get('/', authenticateToken, async (req, res) => {
  const query = parseRequest(replyTemplateQuerySchema, req.query, res)
  if (!query) return
  const db = forOrg(req.user!.organizationId)
  const where = query.canal ? { OR: [{ canal: query.canal }, { canal: null }] } : {}
  const templates = await db.replyTemplate.findMany({ where, orderBy: { titre: 'asc' } })
  res.json(templates)
})

router.post('/', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const input = parseRequest(replyTemplateWriteSchema, req.body, res)
  if (!input) return
  const { titre, corps, canal } = input
  const db = forOrg(req.user!.organizationId)
  const template = await db.replyTemplate.create({
    data: { organizationId: req.user!.organizationId, titre, corps, canal: canal || null },
  })
  res.status(201).json(template)
})

router.put('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const input = parseRequest(replyTemplateWriteSchema, req.body, res)
  if (!input) return
  const { titre, corps, canal } = input
  const db = forOrg(req.user!.organizationId)
  const existing = await db.replyTemplate.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: 'Modèle de réponse introuvable.' })
  const template = await db.replyTemplate.update({
    where: { id: existing.id },
    data: { titre, corps, canal: canal || null },
  })
  res.json(template)
})

router.delete('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const existing = await db.replyTemplate.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: 'Modèle de réponse introuvable.' })
  await db.replyTemplate.delete({ where: { id: existing.id } })
  res.json({ success: true })
})

export default router
