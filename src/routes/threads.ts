import { Router } from 'express'
import { buildNotificationEmail, sendNotificationEmail } from '../lib/email'
import { buildResendClient } from '../lib/resendClient'
import { getDecryptedResendKey } from '../helpers/resendAccount'
import { createActivity } from '../helpers/thread'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import prisma from '../lib/prisma'

const router = Router()

function isManager(orgRole: string): boolean {
  return orgRole === 'OWNER' || orgRole === 'ADMIN'
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    const { canal, status, folder, q, take, skip } = req.query
    const where: Record<string, unknown> = {}
    if (canal) where.canal = canal
    if (status) where.status = status

    // Dossiers : inbox (reçus), sent (envoyés), archive, trash (corbeille).
    // Archive et trash sont mutuellement exclusifs (voir /:id/trash qui efface
    // archivedAt) : un fil archivé sort de inbox/sent mais reste hors corbeille.
    if (folder === 'trash') {
      where.deletedAt = { not: null }
    } else if (folder === 'archive') {
      where.deletedAt = null
      where.archivedAt = { not: null }
    } else {
      where.deletedAt = null
      where.archivedAt = null
      where.origin = folder === 'sent' ? 'outbound' : 'inbound'
    }

    if (!isManager(req.user!.orgRole)) {
      where.assignedToId = req.user!.id
    }

    // Recherche texte : sujet/expéditeur + corps des messages du fil. Combinée en AND
    // avec le reste du where (canal/statut/dossier/portée) — Prisma fusionne les clés
    // top-level en AND, seul le contenu du OR ci-dessous porte la recherche elle-même.
    if (typeof q === 'string' && q.trim()) {
      const query = q.trim()
      where.OR = [
        { sujet: { contains: query, mode: 'insensitive' } },
        { externalFrom: { contains: query, mode: 'insensitive' } },
        { externalEmail: { contains: query, mode: 'insensitive' } },
        { messages: { some: { body: { contains: query, mode: 'insensitive' } } } },
      ]
    }

    // Pagination optionnelle (rétrocompatible : sans `take`, comportement inchangé —
    // tout le dossier en un appel, comme avant).
    const takeNum = typeof take === 'string' ? parseInt(take, 10) : undefined
    const skipNum = typeof skip === 'string' ? parseInt(skip, 10) : undefined

    const threads = await db.thread.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      ...(takeNum !== undefined && Number.isFinite(takeNum) ? { take: takeNum } : {}),
      ...(skipNum !== undefined && Number.isFinite(skipNum) ? { skip: skipNum } : {}),
      include: {
        assignedTo: { select: { id: true, nom: true, username: true } },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { id: true, direction: true, fromName: true, body: true, sentAt: true, readAt: true },
        },
        _count: { select: { messages: { where: { direction: 'inbound', readAt: null } } } },
      },
    })

    res.json(
      threads.map(t => ({
        ...t,
        lastMessage: t.messages[0] ?? null,
        unreadCount: t._count.messages,
        messages: undefined,
        _count: undefined,
      }))
    )
  } catch (err) {
    console.error('[GET /api/threads]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    const thread = await db.thread.findUnique({
      where: { id: req.params.id },
      include: {
        assignedTo: { select: { id: true, nom: true, username: true } },
        messages: {
          orderBy: { sentAt: 'asc' },
          include: {
            sentBy: { select: { id: true, nom: true, username: true } },
            attachments: { select: { id: true, filename: true, contentType: true, size: true, url: true } },
          },
        },
      },
    })
    if (!thread) return res.status(404).json({ error: 'Thread introuvable.' })

    if (!isManager(req.user!.orgRole) && thread.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Accès non autorisé.' })
    }

    await db.threadMessage.updateMany({
      where: { threadId: thread.id, direction: 'inbound', readAt: null },
      data: { readAt: new Date() },
    })

    res.json(thread)
  } catch (err) {
    console.error('[GET /api/threads/:id]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.patch('/:id/assign', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { assignedToId } = req.body
  try {
    const db = forOrg(req.user!.organizationId)
    const thread = await db.thread.update({
      where: { id: req.params.id },
      data: { assignedToId: assignedToId || null },
      include: { assignedTo: { select: { id: true, nom: true, email: true } } },
    })

    if (thread.assignedTo) {
      await createActivity(db, req.user!.organizationId, thread.id, req.user!.id, 'assigned', { to: thread.assignedTo.nom })

      const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
      if (org?.resendApiKeyEnc && org.emailContact) {
        const resend = buildResendClient(getDecryptedResendKey(org))
        await sendNotificationEmail(
          resend,
          org.emailContact,
          org.companyName || org.name,
          thread.assignedTo.email,
          `Thread assigné — ${thread.sujet}`,
          buildNotificationEmail(org.companyName || org.name, 'Thread assigné', [
            { label: 'Canal', value: thread.canal },
            { label: 'De', value: `${thread.externalFrom} <${thread.externalEmail}>` },
            { label: 'Sujet', value: thread.sujet },
          ])
        )
      }
    } else {
      await createActivity(db, req.user!.organizationId, thread.id, req.user!.id, 'unassigned', {})
    }

    res.json(thread)
  } catch (err) {
    console.error('[PATCH /api/threads/:id/assign]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.patch('/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body
  const validStatuses = ['nouveau', 'en_cours', 'resolu']
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Statut invalide.' })

  try {
    const db = forOrg(req.user!.organizationId)
    if (!(await canTouchThread(db, req.user!.id, req.user!.orgRole, req.params.id)))
      return res.status(403).json({ error: 'Accès non autorisé.' })
    const prev = await db.thread.findUnique({ where: { id: req.params.id }, select: { status: true } })
    const thread = await db.thread.update({ where: { id: req.params.id }, data: { status } })
    await createActivity(db, req.user!.organizationId, thread.id, req.user!.id, 'status_changed', { from: prev?.status, to: status })
    res.json(thread)
  } catch {
    res.status(404).json({ error: 'Thread introuvable.' })
  }
})

// Accès : OWNER/ADMIN ou utilisateur assigné au fil
async function canTouchThread(db: ReturnType<typeof forOrg>, userId: string, orgRole: string, threadId: string): Promise<boolean> {
  if (isManager(orgRole)) return true
  const t = await db.thread.findUnique({ where: { id: threadId }, select: { assignedToId: true } })
  return !!t && t.assignedToId === userId
}

// Contrepartie explicite du "lu" automatique (effet de bord de GET /:id) : remet
// tous les messages entrants du fil à non-lu, sur demande volontaire de l'utilisateur.
router.patch('/:id/unread', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    if (!(await canTouchThread(db, req.user!.id, req.user!.orgRole, req.params.id)))
      return res.status(403).json({ error: 'Accès non autorisé.' })
    await db.threadMessage.updateMany({
      where: { threadId: req.params.id, direction: 'inbound' },
      data: { readAt: null },
    })
    const thread = await db.thread.findUnique({ where: { id: req.params.id } })
    if (!thread) return res.status(404).json({ error: 'Thread introuvable.' })
    res.json(thread)
  } catch {
    res.status(404).json({ error: 'Thread introuvable.' })
  }
})

router.patch('/:id/trash', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    if (!(await canTouchThread(db, req.user!.id, req.user!.orgRole, req.params.id)))
      return res.status(403).json({ error: 'Accès non autorisé.' })
    // archivedAt: null — un fil trashé sort aussi de l'archive, les deux dossiers
    // restent mutuellement exclusifs (voir GET / plus haut).
    const thread = await db.thread.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), archivedAt: null } })
    await createActivity(db, req.user!.organizationId, thread.id, req.user!.id, 'trashed', {})
    res.json(thread)
  } catch {
    res.status(404).json({ error: 'Thread introuvable.' })
  }
})

router.patch('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    if (!(await canTouchThread(db, req.user!.id, req.user!.orgRole, req.params.id)))
      return res.status(403).json({ error: 'Accès non autorisé.' })
    const thread = await db.thread.update({ where: { id: req.params.id }, data: { archivedAt: new Date() } })
    await createActivity(db, req.user!.organizationId, thread.id, req.user!.id, 'archived', {})
    res.json(thread)
  } catch {
    res.status(404).json({ error: 'Thread introuvable.' })
  }
})

router.patch('/:id/unarchive', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    if (!(await canTouchThread(db, req.user!.id, req.user!.orgRole, req.params.id)))
      return res.status(403).json({ error: 'Accès non autorisé.' })
    const thread = await db.thread.update({ where: { id: req.params.id }, data: { archivedAt: null } })
    await createActivity(db, req.user!.organizationId, thread.id, req.user!.id, 'unarchived', {})
    res.json(thread)
  } catch {
    res.status(404).json({ error: 'Thread introuvable.' })
  }
})

// Pas de journal d'activité pour l'étoile : comme /unread, c'est un simple
// marqueur personnel, pas un événement métier du fil.
router.patch('/:id/star', authenticateToken, async (req, res) => {
  const { starred } = req.body
  if (typeof starred !== 'boolean') return res.status(400).json({ error: 'starred (boolean) requis.' })
  try {
    const db = forOrg(req.user!.organizationId)
    if (!(await canTouchThread(db, req.user!.id, req.user!.orgRole, req.params.id)))
      return res.status(403).json({ error: 'Accès non autorisé.' })
    const thread = await db.thread.update({ where: { id: req.params.id }, data: { starred } })
    res.json(thread)
  } catch {
    res.status(404).json({ error: 'Thread introuvable.' })
  }
})

router.patch('/:id/restore', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    if (!(await canTouchThread(db, req.user!.id, req.user!.orgRole, req.params.id)))
      return res.status(403).json({ error: 'Accès non autorisé.' })
    const thread = await db.thread.update({ where: { id: req.params.id }, data: { deletedAt: null } })
    await createActivity(db, req.user!.organizationId, thread.id, req.user!.id, 'restored', {})
    res.json(thread)
  } catch {
    res.status(404).json({ error: 'Thread introuvable.' })
  }
})

// Actions groupées (sélection multiple liste web/mobile) : statut / archivage /
// corbeille sur plusieurs fils en un appel. Restreint via le `where` aux fils
// accessibles à l'appelant (mêmes règles que les routes individuelles) — les ids
// inaccessibles ou inexistants sont silencieusement ignorés par updateMany plutôt
// que de faire échouer tout l'appel pour une sélection partiellement invalide.
router.patch('/bulk', authenticateToken, async (req, res) => {
  const { ids, status, archivedAt, deletedAt } = req.body
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id: unknown) => typeof id === 'string')) {
    return res.status(400).json({ error: 'ids (tableau non vide) requis.' })
  }
  if (ids.length > 200) return res.status(400).json({ error: 'Trop de fils sélectionnés (200 maximum).' })

  const data: Record<string, unknown> = {}
  if (status !== undefined) {
    if (!['nouveau', 'en_cours', 'resolu'].includes(status)) return res.status(400).json({ error: 'Statut invalide.' })
    data.status = status
  }
  if (typeof archivedAt === 'boolean') data.archivedAt = archivedAt ? new Date() : null
  if (typeof deletedAt === 'boolean') {
    data.deletedAt = deletedAt ? new Date() : null
    // Mêmes dossiers mutuellement exclusifs que /:id/trash.
    if (deletedAt) data.archivedAt = null
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Aucune modification demandée.' })

  try {
    const db = forOrg(req.user!.organizationId)
    const where = {
      id: { in: ids as string[] },
      ...(isManager(req.user!.orgRole) ? {} : { assignedToId: req.user!.id }),
    }
    const result = await db.thread.updateMany({ where, data })
    res.json({ updated: result.count })
  } catch (err) {
    console.error('[PATCH /api/threads/bulk]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

// DELETE /api/threads/:id — suppression définitive (uniquement depuis la corbeille)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    if (!(await canTouchThread(db, req.user!.id, req.user!.orgRole, req.params.id)))
      return res.status(403).json({ error: 'Accès non autorisé.' })
    const thread = await db.thread.findUnique({ where: { id: req.params.id }, select: { deletedAt: true } })
    if (!thread) return res.status(404).json({ error: 'Thread introuvable.' })
    if (!thread.deletedAt) return res.status(400).json({ error: 'Mettez d\'abord le fil à la corbeille.' })
    await db.thread.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

router.get('/:id/activity', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    const thread = await db.thread.findUnique({ where: { id: req.params.id }, select: { assignedToId: true } })
    if (!thread) return res.status(404).json({ error: 'Thread introuvable.' })
    if (!isManager(req.user!.orgRole) && thread.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Accès non autorisé.' })
    }

    const activities = await db.threadActivity.findMany({
      where: { threadId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, nom: true, username: true } } },
    })
    res.json(activities)
  } catch (err) {
    console.error('[GET /api/threads/:id/activity]', err)
    res.status(500).json({ error: 'Erreur serveur.' })
  }
})

export default router
