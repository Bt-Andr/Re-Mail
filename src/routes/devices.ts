import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import prisma from '../lib/prisma'
import { parseRequest } from '../validation/request'
import { deviceRegistrationSchema, deviceTokenParamSchema } from '../validation/schemas'

const router = Router()

// Enregistre/rafraîchit le token de push (Expo) de l'app mobile ou du web push
// pour l'utilisateur courant. expoPushToken est unique globalement (un même
// appareil ne peut appartenir qu'à un seul utilisateur à la fois) — un upsert
// par ce champ est donc légitime ici (c'est un vrai @unique simple, pas composite).
router.post('/', authenticateToken, async (req, res) => {
  const input = parseRequest(deviceRegistrationSchema, req.body, res)
  if (!input) return
  const { expoPushToken, platform } = input
  // expoPushToken est unique globalement : l'appareil peut changer de compte ou
  // d'organisation. Cet upsert doit donc utiliser Prisma global, avec une clé unique
  // à haute entropie, et réaffecter explicitement tenant + utilisateur à la session.
  const device = await prisma.deviceToken.upsert({
    where: { expoPushToken },
    create: { expoPushToken, platform, userId: req.user!.id, organizationId: req.user!.organizationId },
    update: { organizationId: req.user!.organizationId, userId: req.user!.id, platform },
  })
  res.status(201).json(device)
})

router.delete('/:expoPushToken', authenticateToken, async (req, res) => {
  const input = parseRequest(deviceTokenParamSchema, req.params, res)
  if (!input) return
  const db = forOrg(req.user!.organizationId)
  const existing = await db.deviceToken.findUnique({ where: { expoPushToken: input.expoPushToken } })
  if (!existing || existing.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Appareil introuvable.' })
  }
  await db.deviceToken.delete({ where: { id: existing.id } })
  res.json({ success: true })
})

export default router
