import { Router } from 'express'
import { buildNotificationEmail, sendNotificationEmail } from '../lib/email'
import { buildResendClient } from '../lib/resendClient'
import { getDecryptedResendKey } from '../helpers/resendAccount'
import { createActivity, getHiddenProCanaux } from '../helpers/thread'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import prisma from '../lib/prisma'
import { parseRequest } from '../validation/request'
import {
  threadAssignmentSchema,
  threadBulkActionSchema,
  threadListQuerySchema,
  threadStarSchema,
  threadStatusSchema,
} from '../validation/schemas'

const router = Router()

function isManager(orgRole: string): boolean {
  return orgRole === 'OWNER' || orgRole === 'ADMIN'
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    const query = parseRequest(threadListQuerySchema, req.query, res)
    if (!query) return
    const { canal, status, folder, q, take, skip, account } = query
    const where: Record<string, unknown> = {}
    const andFilters: Record<string, unknown>[] = []
    const ownedMailboxes = await db.externalMailboxConnection.findMany({
      where: { userId: req.user!.id },
      select: { id: true },
    })
    const ownedMailboxIds = ownedMailboxes.map(mailbox => mailbox.id)

    // Les fils Resend (sourceId null) sont des ressources d'equipe. Un fil lie a
    // une boite externe reste strictement personnel a son proprietaire, y compris
    // face a un OWNER/ADMIN de la meme organisation.
    andFilters.push({ OR: [{ sourceId: null }, { sourceId: { in: ownedMailboxIds } }] })
    where.AND = andFilters
    if (status) where.status = status
    // Switcher de compte (voir routes/accounts.ts) : 'resend' = fils sans boîte externe
    // d'origine (sourceId null, webhook Resend/compose sortant) ; sinon un
    // ExternalMailboxConnection.id précis. Absent = tous les fils, "Toutes les boîtes".
    if (account) {
      if (account !== 'resend' && !ownedMailboxIds.includes(account)) return res.json([])
      where.sourceId = account === 'resend' ? null : account
    }

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
      const direction = folder === 'sent' ? 'outbound' : 'inbound'
      // Un fil mixte appartient aux deux dossiers. `origin` garde les rares fils
      // historiques sans message visibles dans leur dossier d'origine.
      andFilters.push({ OR: [{ messages: { some: { direction } } }, { origin: direction }] })
    }

    if (!isManager(req.user!.orgRole)) {
      where.assignedToId = req.user!.id
    }

    // Combine avec le filtre `canal` explicite (switcher de dossier par canal) : un
    // canal demandé mais caché (adresse pro non connectée par l'appelant) ne doit jamais
    // silencieusement ignorer la restriction de visibilité — court-circuite en résultat
    // vide plutôt que de laisser `where.canal` écraser le `notIn` ci-dessous.
    const hiddenCanaux = await getHiddenProCanaux(db, req.user!.id)
    if (canal) {
      if (hiddenCanaux.includes(canal)) return res.json([])
      where.canal = canal
    } else if (hiddenCanaux.length > 0) {
      where.canal = { notIn: hiddenCanaux }
    }

    // Recherche texte : sujet/expéditeur + corps des messages du fil. Combinée en AND
    // avec le reste du where (canal/statut/dossier/portée) — Prisma fusionne les clés
    // top-level en AND, seul le contenu du OR ci-dessous porte la recherche elle-même.
    if (q) {
      andFilters.push({
        OR: [
          { sujet: { contains: q, mode: 'insensitive' } },
          { externalFrom: { contains: q, mode: 'insensitive' } },
          { externalEmail: { contains: q, mode: 'insensitive' } },
          { messages: { some: { body: { contains: q, mode: 'insensitive' } } } },
        ],
      })
    }

    // Pagination optionnelle (rétrocompatible : sans `take`, comportement inchangé —
    // tout le dossier en un appel, comme avant).
    const threads = await db.thread.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      ...(take !== undefined ? { take } : {}),
      ...(skip !== undefined ? { skip } : {}),
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
        unreadCount: folder === 'sent' ? 0 : t._count.messages,
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

    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, thread.id, res)) return

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
  const input = parseRequest(threadAssignmentSchema, req.body, res)
  if (!input) return
  const { assignedToId } = input
  try {
    const db = forOrg(req.user!.organizationId)
    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, req.params.id, res)) return
    if (assignedToId) {
      const assignee = await db.user.findUnique({ where: { id: assignedToId }, select: { id: true } })
      if (!assignee) return res.status(400).json({ error: "L'utilisateur assigné n'appartient pas à cette organisation." })
    }
    const current = await db.thread.findUnique({ where: { id: req.params.id }, select: { sourceId: true } })
    if (current?.sourceId && assignedToId !== req.user!.id) {
      return res.status(400).json({ error: 'Une boîte personnelle ne peut pas être attribuée à un autre utilisateur.' })
    }
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
  const input = parseRequest(threadStatusSchema, req.body, res)
  if (!input) return
  const { status } = input

  try {
    const db = forOrg(req.user!.organizationId)
    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, req.params.id, res)) return
    const prev = await db.thread.findUnique({ where: { id: req.params.id }, select: { status: true } })
    const thread = await db.thread.update({ where: { id: req.params.id }, data: { status } })
    await createActivity(db, req.user!.organizationId, thread.id, req.user!.id, 'status_changed', { from: prev?.status, to: status })
    res.json(thread)
  } catch {
    res.status(404).json({ error: 'Thread introuvable.' })
  }
})

// Accès : OWNER/ADMIN ou utilisateur assigné au fil — SAUF si le fil vient d'une
// adresse pro que l'appelant n'a pas connectée (voir getHiddenProCanaux), auquel cas
// même un manager est refusé (même règle pour tout le monde, décision produit actée).
// 'not_found' (thread hors du scope forOrg, ex. autre organisation) est distinct de
// 'forbidden' (thread visible dans l'org mais accès refusé) : la distinction importe
// pour l'isolation tenant — un thread d'une autre org doit rester introuvable (404),
// jamais confirmé comme existant via un 403 (voir test threads.test.ts).
type ThreadAccess = 'not_found' | 'forbidden' | 'ok'
async function checkThreadAccess(db: ReturnType<typeof forOrg>, userId: string, orgRole: string, threadId: string): Promise<ThreadAccess> {
  const t = await db.thread.findUnique({ where: { id: threadId }, select: { assignedToId: true, canal: true, sourceId: true } })
  if (!t) return 'not_found'
  if (t.sourceId) {
    const ownedMailbox = await db.externalMailboxConnection.findFirst({ where: { id: t.sourceId, userId }, select: { id: true } })
    if (!ownedMailbox) return 'forbidden'
  }
  const hiddenCanaux = await getHiddenProCanaux(db, userId)
  if (hiddenCanaux.includes(t.canal)) return 'forbidden'
  if (isManager(orgRole)) return 'ok'
  return t.assignedToId === userId ? 'ok' : 'forbidden'
}

// Garde de début de handler : écrit la réponse 404/403 appropriée et renvoie true si
// l'accès est refusé, auquel cas l'appelant doit `return` immédiatement. Un seul point
// pour les 7 routes PATCH/DELETE ci-dessous plutôt que dupliquer le if/else à chacune.
async function denyThreadAccess(
  db: ReturnType<typeof forOrg>,
  userId: string,
  orgRole: string,
  threadId: string,
  res: import('express').Response
): Promise<boolean> {
  const access = await checkThreadAccess(db, userId, orgRole, threadId)
  if (access === 'not_found') {
    res.status(404).json({ error: 'Thread introuvable.' })
    return true
  }
  if (access === 'forbidden') {
    res.status(403).json({ error: 'Accès non autorisé.' })
    return true
  }
  return false
}

// Contrepartie explicite du "lu" automatique (effet de bord de GET /:id) : remet
// tous les messages entrants du fil à non-lu, sur demande volontaire de l'utilisateur.
router.patch('/:id/unread', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, req.params.id, res)) return
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
    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, req.params.id, res)) return
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
    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, req.params.id, res)) return
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
    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, req.params.id, res)) return
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
  const input = parseRequest(threadStarSchema, req.body, res)
  if (!input) return
  const { starred } = input
  try {
    const db = forOrg(req.user!.organizationId)
    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, req.params.id, res)) return
    const thread = await db.thread.update({ where: { id: req.params.id }, data: { starred } })
    res.json(thread)
  } catch {
    res.status(404).json({ error: 'Thread introuvable.' })
  }
})

router.patch('/:id/restore', authenticateToken, async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, req.params.id, res)) return
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
  const input = parseRequest(threadBulkActionSchema, req.body, res)
  if (!input) return
  const { ids, status, archivedAt, deletedAt } = input

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
  try {
    const db = forOrg(req.user!.organizationId)
    const [hiddenCanaux, ownedMailboxes] = await Promise.all([
      getHiddenProCanaux(db, req.user!.id),
      db.externalMailboxConnection.findMany({ where: { userId: req.user!.id }, select: { id: true } }),
    ])
    const ownedMailboxIds = ownedMailboxes.map(mailbox => mailbox.id)
    const where = {
      id: { in: ids as string[] },
      ...(isManager(req.user!.orgRole) ? {} : { assignedToId: req.user!.id }),
      ...(hiddenCanaux.length > 0 ? { canal: { notIn: hiddenCanaux } } : {}),
      AND: [{ OR: [{ sourceId: null }, { sourceId: { in: ownedMailboxIds } }] }],
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
    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, req.params.id, res)) return
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
    if (await denyThreadAccess(db, req.user!.id, req.user!.orgRole, req.params.id, res)) return

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
