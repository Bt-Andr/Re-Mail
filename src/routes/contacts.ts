import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'

const router = Router()

interface Contact {
  email: string
  name: string | null
  lastUsed: Date
  count: number
}

// toEmails/ccEmails/bccEmails sont des adresses brutes (jamais "Nom <email>"),
// séparées par des virgules quand il y en a plusieurs — voir routes/mail.ts où
// elles sont écrites (`cc.join(',')`).
function splitAddresses(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(a => a.includes('@'))
}

// Carnet d'adresses dérivé de l'historique des échanges (pas de table dédiée) :
// agrège fromEmail/toEmails/ccEmails de tous les messages de l'org, borné à un
// nombre de messages raisonnable pour l'agrégation en mémoire plutôt que du SQL
// brut — un carnet d'adresses n'a pas besoin d'être exhaustif sur des années
// d'historique, seulement représentatif des contacts récents/fréquents.
const MAX_MESSAGES_SCANNED = 5000
const MAX_CONTACTS_RETURNED = 50

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    const messages = await db.threadMessage.findMany({
      select: { fromName: true, fromEmail: true, toEmails: true, ccEmails: true, bccEmails: true, sentAt: true },
      orderBy: { sentAt: 'desc' },
      take: MAX_MESSAGES_SCANNED,
    })

    const contacts = new Map<string, Contact>()
    const add = (email: string, name: string | null, sentAt: Date) => {
      const existing = contacts.get(email)
      if (existing) {
        existing.count += 1
        if (sentAt > existing.lastUsed) {
          existing.lastUsed = sentAt
          if (name) existing.name = name
        }
      } else {
        contacts.set(email, { email, name, lastUsed: sentAt, count: 1 })
      }
    }

    for (const m of messages) {
      const fromEmail = m.fromEmail?.trim().toLowerCase()
      if (fromEmail?.includes('@')) add(fromEmail, m.fromName || null, m.sentAt)
      for (const addr of splitAddresses(m.toEmails)) add(addr, null, m.sentAt)
      for (const addr of splitAddresses(m.ccEmails)) add(addr, null, m.sentAt)
      for (const addr of splitAddresses(m.bccEmails)) add(addr, null, m.sentAt)
    }

    let list = [...contacts.values()]
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : ''
    if (q) list = list.filter(c => c.email.includes(q) || c.name?.toLowerCase().includes(q))

    // Récence d'abord (comme une autocomplétion de client mail classique), fréquence
    // en second critère pour départager des contacts touchés le même jour.
    list.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime() || b.count - a.count)

    res.json(list.slice(0, MAX_CONTACTS_RETURNED))
  } catch (err) {
    console.error('[GET /api/contacts]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

export default router
