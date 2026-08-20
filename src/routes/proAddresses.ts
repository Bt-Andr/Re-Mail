import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import prisma from '../lib/prisma'

const router = Router()

// GET /api/pro-addresses/mine — adresses pro attribuées à l'utilisateur courant (via
// ThreadRoutingRule.assignToId), reconstruites en email complet via le domaine Resend
// vérifié de l'org — canal est déjà local-part-seul (voir schema.prisma), pas de champ
// dédié nécessaire pour composer l'adresse. claimedAt distingue "attribuée mais pas
// encore connectée" (badge "À connecter" côté client) de "connectée".
router.get('/mine', authenticateToken, async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const org = await prisma.organization.findUnique({
    where: { id: req.user!.organizationId },
    select: { resendVerifiedDomain: true },
  })
  if (!org?.resendVerifiedDomain) return res.json([])

  const rules = await db.threadRoutingRule.findMany({
    where: { assignToId: req.user!.id, active: true },
    orderBy: { canal: 'asc' },
  })
  res.json(rules.map(r => ({ id: r.id, canal: r.canal, email: `${r.canal}@${org.resendVerifiedDomain}`, claimedAt: r.claimedAt })))
})

// POST /api/pro-addresses/:id/claim — confirme la connexion d'une adresse pro déjà
// attribuée par un admin. Aucun identifiant à saisir : l'attribution elle-même EST la
// preuve d'accès (un admin de l'org l'a posée), contrairement à Gmail/IMAP qui exigent
// une preuve de possession. Idempotent. 404 générique si l'id ne correspond à aucune
// règle assignée à CET utilisateur — ne jamais révéler l'existence de la règle de
// quelqu'un d'autre.
router.post('/:id/claim', authenticateToken, async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const updated = await db.threadRoutingRule.updateMany({
    where: { id: req.params.id, assignToId: req.user!.id },
    data: { claimedAt: new Date() },
  })
  if (updated.count === 0) return res.status(404).json({ error: 'Adresse introuvable.' })
  res.json({ success: true })
})

export default router
