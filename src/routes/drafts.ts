import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import { parseRequest } from '../validation/request'
import { draftCreateSchema, draftUpdateSchema } from '../validation/schemas'

const router = Router()

// Les brouillons sont personnels : chaque utilisateur ne voit que les siens
// (le scoping par organisation via forOrg s'ajoute à ce filtre par userId).

router.get('/', authenticateToken, async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const drafts = await db.mailDraft.findMany({
    where: { userId: req.user!.id },
    orderBy: { updatedAt: 'desc' },
  })
  res.json(drafts)
})

router.post('/', authenticateToken, async (req, res) => {
  const input = parseRequest(draftCreateSchema, req.body, res)
  if (!input) return
  const { toEmail, ccEmail, bccEmail, subject, body } = input
  const db = forOrg(req.user!.organizationId)
  const draft = await db.mailDraft.create({
    data: {
      organizationId: req.user!.organizationId,
      userId: req.user!.id,
      toEmail,
      ccEmail,
      bccEmail,
      subject,
      body,
    },
  })
  res.status(201).json(draft)
})

router.put('/:id', authenticateToken, async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const existing = await db.mailDraft.findUnique({ where: { id: req.params.id } })
  if (!existing || existing.userId !== req.user!.id)
    return res.status(404).json({ error: 'Brouillon introuvable.' })
  const input = parseRequest(draftUpdateSchema, req.body, res)
  if (!input) return
  const draft = await db.mailDraft.update({
    where: { id: req.params.id },
    data: input,
  })
  res.json(draft)
})

router.delete('/:id', authenticateToken, async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const existing = await db.mailDraft.findUnique({ where: { id: req.params.id } })
  if (!existing || existing.userId !== req.user!.id)
    return res.status(404).json({ error: 'Brouillon introuvable.' })
  await db.mailDraft.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

export default router
