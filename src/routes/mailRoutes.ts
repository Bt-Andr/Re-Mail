import { Router } from 'express'
import type { Response } from 'express'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import prisma from '../lib/prisma'
import { parseRequest } from '../validation/request'
import {
  emailBelongsToDomain,
  mailRouteBulkSchema,
  mailRouteCreateSchema,
  mailRouteUpdateSchema,
} from '../validation/schemas'

const router = Router()

async function requireConfiguredDomain(organizationId: string, res: Response): Promise<string | null> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { resendVerifiedDomain: true } })
  if (!org?.resendVerifiedDomain) {
    res.status(400).json({ error: 'Configurez d’abord un domaine Resend vérifié.' })
    return null
  }
  return org.resendVerifiedDomain.toLowerCase()
}

function rejectAliasOutsideDomain(alias: string, domain: string, res: Response): boolean {
  if (emailBelongsToDomain(alias, domain)) return false
  res.status(400).json({ error: `L’alias doit appartenir au domaine ${domain}.` })
  return true
}

router.get('/', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const routes = await db.mailRoute.findMany({ orderBy: { alias: 'asc' } })
  res.json(routes)
})

router.post('/', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const input = parseRequest(mailRouteCreateSchema, req.body, res)
  if (!input) return
  const { alias, personalEmail, displayName, active } = input
  // personalEmail est optionnel : l'alias reçoit déjà ses emails comme threads dans
  // l'inbox sans lui — il ne sert qu'au transfert vers une boîte perso, ajoutable plus tard.
  const domain = await requireConfiguredDomain(req.user!.organizationId, res)
  if (!domain || rejectAliasOutsideDomain(alias, domain, res)) return
  try {
    const db = forOrg(req.user!.organizationId)
    const route = await db.mailRoute.create({
      data: {
        organizationId: req.user!.organizationId,
        alias,
        personalEmail: personalEmail || '',
        displayName: displayName || null,
        active: active ?? true,
      },
    })
    res.status(201).json(route)
  } catch {
    res.status(409).json({ error: 'Cet alias existe déjà.' })
  }
})

// Import en masse : priorité à la configuration des alias, le transfert personnel
// (personalEmail) est optionnel et peut être complété plus tard via l'édition.
router.post('/bulk', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const input = parseRequest(mailRouteBulkSchema, req.body, res)
  if (!input) return
  const { routes } = input
  const domain = await requireConfiguredDomain(req.user!.organizationId, res)
  if (!domain) return

  const db = forOrg(req.user!.organizationId)
  const created: unknown[] = []
  const skipped: { alias: string; reason: string }[] = []
  const seen = new Set<string>()

  for (const raw of routes) {
    const parsed = mailRouteCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const rawAlias = typeof raw === 'object' && raw !== null && 'alias' in raw && typeof raw.alias === 'string' ? raw.alias : '(vide)'
      skipped.push({ alias: rawAlias, reason: 'alias ou personalEmail invalide' })
      continue
    }
    const { alias, personalEmail, displayName } = parsed.data
    if (!emailBelongsToDomain(alias, domain)) {
      skipped.push({ alias, reason: `alias hors du domaine ${domain}` })
      continue
    }
    if (seen.has(alias)) {
      skipped.push({ alias, reason: 'doublon dans la liste importée' })
      continue
    }
    seen.add(alias)

    const existing = await db.mailRoute.findFirst({ where: { alias } })
    if (existing) {
      skipped.push({ alias, reason: 'existe déjà' })
      continue
    }

    try {
      const route = await db.mailRoute.create({
        data: { organizationId: req.user!.organizationId, alias, personalEmail: personalEmail || '', displayName: displayName || null, active: true },
      })
      created.push(route)
    } catch {
      skipped.push({ alias, reason: 'erreur lors de la création' })
    }
  }

  res.json({ created, skipped })
})

router.put('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const db = forOrg(req.user!.organizationId)
  const existing = await db.mailRoute.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Route introuvable.' })

  const input = parseRequest(mailRouteUpdateSchema, req.body, res)
  if (!input) return
  const { alias, personalEmail, displayName, active } = input
  if (alias) {
    const domain = await requireConfiguredDomain(req.user!.organizationId, res)
    if (!domain || rejectAliasOutsideDomain(alias, domain, res)) return
  }
  try {
    const route = await db.mailRoute.update({
      where: { id: req.params.id },
      data: {
        alias,
        personalEmail,
        displayName: displayName === undefined ? undefined : displayName || null,
        active,
      },
    })
    res.json(route)
  } catch {
    res.status(404).json({ error: 'Route introuvable.' })
  }
})

router.delete('/:id', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const db = forOrg(req.user!.organizationId)
    await db.mailRoute.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(404).json({ error: 'Route introuvable.' })
  }
})

export default router
