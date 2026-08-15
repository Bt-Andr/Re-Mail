import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import { getAllowedSenders } from '../helpers/senders'

const router = Router()

// Notion unifiée "compte" utilisée à la fois par le switcher (filtre l'inbox via
// GET /threads?account=) et par le compositeur (adresse d'expédition par défaut) —
// un seul concept côté backend plutôt que deux sources à réconcilier côté client.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    const userId = req.user!.id

    const [connections, senders] = await Promise.all([
      db.externalMailboxConnection.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      getAllowedSenders(db, userId),
    ])

    const connectionEmails = new Set(connections.map(c => c.email.toLowerCase()))
    const resendSenders = senders.filter(s => !connectionEmails.has(s.email.toLowerCase()))

    const accounts = [
      ...(resendSenders.length > 0
        ? [
            {
              id: 'resend',
              kind: 'resend' as const,
              provider: 'resend' as const,
              email: (resendSenders.find(s => s.isDefault) ?? resendSenders[0]).email,
              label: "Adresses de l'organisation",
              status: null,
            },
          ]
        : []),
      ...connections.map(c => ({
        id: c.id,
        kind: 'mailbox' as const,
        provider: c.provider as 'gmail' | 'imap',
        email: c.email,
        label: c.email,
        status: c.status as 'connected' | 'error',
      })),
    ]

    res.json(accounts)
  } catch (err) {
    console.error('[GET /api/accounts]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

export default router
