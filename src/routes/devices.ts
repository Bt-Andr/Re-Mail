import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'

const router = Router()

// Enregistre/rafraîchit le token de push (Expo) de l'app mobile ou du web push
// pour l'utilisateur courant. expoPushToken est unique globalement (un même
// appareil ne peut appartenir qu'à un seul utilisateur à la fois) — un upsert
// par ce champ est donc légitime ici (c'est un vrai @unique simple, pas composite).
router.post('/', authenticateToken, async (req, res) => {
  const { expoPushToken, platform } = req.body
  if (!expoPushToken || typeof expoPushToken !== 'string') {
    return res.status(400).json({ error: 'expoPushToken requis.' })
  }
  try {
    const db = forOrg(req.user!.organizationId)
    const device = await db.deviceToken.upsert({
      where: { expoPushToken },
      create: { expoPushToken, platform: platform || 'unknown', userId: req.user!.id, organizationId: req.user!.organizationId },
      update: { userId: req.user!.id, platform: platform || 'unknown' },
    })
    res.status(201).json(device)
  } catch (err) {
    console.error('[POST /api/devices]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.delete('/:expoPushToken', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    const existing = await db.deviceToken.findUnique({ where: { expoPushToken: req.params.expoPushToken } })
    if (!existing || existing.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Appareil introuvable.' })
    }
    await db.deviceToken.delete({ where: { expoPushToken: req.params.expoPushToken } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Appareil introuvable.' })
  }
})

export default router
