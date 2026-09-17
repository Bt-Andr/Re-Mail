import { Router } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import config from '../config'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import { canCreateOrgRole } from '../lib/orgPermissions'
import { csvRow } from '../lib/csv'
import { parseConfigImport, ImportedUser, ImportedMailRoute, ImportedRoutingRule, ImportedReplyTemplate } from '../lib/configImport'
import { configImportUpload } from '../lib/upload'
import { INVITE_HYGIENE_TTL_MS } from './userInvites'
import {
  getDecryptedResendKey,
  getResendDomain,
  listResendDomains,
  encryptResendKey,
  encryptWebhookSecret,
  generateWebhookToken,
} from '../helpers/resendAccount'
import { parseRequest } from '../validation/request'
import {
  emailBelongsToDomain,
  mailRouteCreateSchema,
  organizationUpdateSchema,
  resendConnectSchema,
  resendDomainSelectionSchema,
  resendWebhookSecretSchema,
} from '../validation/schemas'

const router = Router()

function webhookUrlFor(webhookToken: string): string {
  return `${config.backendUrl}/api/inbound-mail/${webhookToken}`
}

// Résumé d'onboarding : sert à afficher la checklist "Connecter Resend → coller
// l'URL de webhook → créer une route mail" dans le dashboard.
router.get('/me', authenticateToken, async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!org) return res.status(404).json({ error: 'Organisation introuvable.' })

  const [mailRoutesCount, routingRulesCount, memberCount, externalMailboxCount, currentUser, firstOutbound, firstInbound] = await Promise.all([
    prisma.mailRoute.count({ where: { organizationId: org.id } }),
    prisma.threadRoutingRule.count({ where: { organizationId: org.id, active: true } }),
    prisma.user.count({ where: { organizationId: org.id } }),
    prisma.externalMailboxConnection.count({ where: { organizationId: org.id, status: 'connected' } }),
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { proEmail: true } }),
    prisma.threadMessage.findFirst({
      where: { organizationId: org.id, direction: 'outbound', thread: { sourceId: null } },
      orderBy: { sentAt: 'asc' },
      select: { sentAt: true },
    }),
    prisma.inboundEvent.findFirst({
      where: { organizationId: org.id, provider: 'resend', status: 'completed' },
      orderBy: { processedAt: 'asc' },
      select: { processedAt: true },
    }),
  ])

  const resendConnected = !!org.resendApiKeyEnc
  const domainSelected = !!org.resendVerifiedDomain
  const webhookConfigured = !!org.webhookSecretEnc
  const webhookVerified = !!org.webhookVerifiedAt
  const firstAddressConfigured = mailRoutesCount > 0 || routingRulesCount > 0 || !!currentUser?.proEmail
  const firstOutboundAt = firstOutbound?.sentAt ?? null
  const firstInboundAt = firstInbound?.processedAt ?? null

  res.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    companyName: org.companyName,
    emailContact: org.emailContact,
    resendConnected,
    resendApiKeyLast4: org.resendApiKeyLast4,
    resendVerifiedDomain: org.resendVerifiedDomain,
    webhookConfigured,
    webhookUrl: webhookUrlFor(org.webhookToken),
    mailRoutesCount,
    externalMailboxCount,
    isPersonal: org.isPersonal,
    memberCount,
    setupStatus: {
      resendConnected,
      domainSelected,
      webhookConfigured,
      webhookVerified,
      firstAddressConfigured,
      firstOutboundAt,
      firstInboundAt,
      operational:
        resendConnected &&
        domainSelected &&
        webhookConfigured &&
        webhookVerified &&
        firstAddressConfigured &&
        firstOutboundAt !== null &&
        firstInboundAt !== null,
    },
  })
})

router.put('/me', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const input = parseRequest(organizationUpdateSchema, req.body, res)
  if (!input) return
  const { name, companyName, emailContact } = input
  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (companyName !== undefined) data.companyName = companyName || null
  if (emailContact !== undefined) data.emailContact = emailContact || null

  const org = await prisma.organization.update({ where: { id: req.user!.organizationId }, data })
  res.json({ id: org.id, name: org.name, companyName: org.companyName, emailContact: org.emailContact })
})

// Étape 1 : l'org colle sa clé API Resend — on la valide en listant ses domaines
// (401 => clé invalide) et on la stocke chiffrée. On renvoie aussi l'URL de
// webhook unique à coller côté Resend (Domaines → Inbound).
router.post('/me/resend/connect', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const input = parseRequest(resendConnectSchema, req.body, res)
  if (!input) return
  const { apiKey } = input

  try {
    const domains = await listResendDomains(apiKey)
    const { enc, last4 } = encryptResendKey(apiKey)

    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { resendApiKeyEnc: enc, resendApiKeyLast4: last4, resendConnectedAt: new Date() },
    })

    res.json({
      verifiedDomains: domains.filter(d => d.status.toLowerCase() === 'verified').map(d => d.name.toLowerCase()),
      webhookUrl: webhookUrlFor(org.webhookToken),
    })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// Recharge les domaines à chaque reprise du parcours. Les clients ne proposent
// jamais une valeur libre : seul un domaine actuellement vérifié chez Resend peut
// être sélectionné, y compris après un rechargement de page ou de l'application.
router.get('/me/resend/domains', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!org?.resendApiKeyEnc) {
    return res.status(400).json({ error: 'Connectez d’abord une clé API Resend.' })
  }

  try {
    const domains = await listResendDomains(getDecryptedResendKey(org))
    res.json({
      verifiedDomains: domains
        .filter(domain => domain.status.toLowerCase() === 'verified')
        .map(domain => domain.name.toLowerCase()),
    })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})

router.get('/me/resend/domain-status', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!org?.resendApiKeyEnc || !org.resendVerifiedDomain) {
    return res.status(400).json({ error: 'Sélectionnez d’abord un domaine Resend vérifié.' })
  }

  try {
    const apiKey = getDecryptedResendKey(org)
    const domains = await listResendDomains(apiKey)
    const selected = domains.find(domain => domain.name.toLowerCase() === org.resendVerifiedDomain!.toLowerCase())
    if (!selected) return res.status(404).json({ error: 'Le domaine sélectionné n’existe plus dans Resend.' })

    const details = await getResendDomain(apiKey, selected.id)
    const records = (details.records ?? []).map(record => ({
      record: record.record,
      name: record.name,
      type: record.type,
      value: record.value,
      ttl: record.ttl ?? null,
      status: record.status,
      priority: record.priority ?? null,
    }))
    const receivingRecords = records.filter(record => record.record.toLowerCase().includes('receiving'))
    const receivingEnabled = details.capabilities?.receiving?.toLowerCase() === 'enabled'
    const receivingReady =
      receivingEnabled &&
      receivingRecords.length > 0 &&
      receivingRecords.every(record => record.status.toLowerCase() === 'verified')

    res.json({
      name: details.name.toLowerCase(),
      status: details.status,
      sendingEnabled: details.capabilities?.sending?.toLowerCase() === 'enabled',
      receivingEnabled,
      receivingReady,
      records,
    })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})

router.post('/me/resend/select-domain', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const input = parseRequest(resendDomainSelectionSchema, req.body, res)
  if (!input) return
  const { domain } = input

  const currentOrg = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!currentOrg?.resendApiKeyEnc) {
    return res.status(400).json({ error: 'Connectez d’abord une clé API Resend.' })
  }

  try {
    const domains = await listResendDomains(getDecryptedResendKey(currentOrg))
    const verified = domains.some(item => item.status.toLowerCase() === 'verified' && item.name.toLowerCase() === domain)
    if (!verified) {
      return res.status(400).json({ error: 'Ce domaine n’est pas vérifié dans le compte Resend connecté.' })
    }
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message })
  }

  const existingRoutes = await prisma.mailRoute.findMany({
    where: { organizationId: req.user!.organizationId },
    select: { alias: true },
  })
  const incompatibleRoute = existingRoutes.find(route => !emailBelongsToDomain(route.alias, domain))
  if (incompatibleRoute) {
    return res.status(400).json({
      error: `Le domaine ne peut pas être changé tant que l’alias ${incompatibleRoute.alias} existe.`,
    })
  }

  const org = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: {
      resendVerifiedDomain: domain,
      webhookTestToken: null,
      webhookTestStartedAt: null,
      webhookVerifiedAt: null,
    },
  })
  res.json({ resendVerifiedDomain: org.resendVerifiedDomain })
})

// Étape manuelle : Resend n'expose pas le secret de signature d'un webhook via
// API — l'org le colle elle-même après l'avoir créé dans son propre dashboard.
router.post('/me/resend/webhook-secret', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const input = parseRequest(resendWebhookSecretSchema, req.body, res)
  if (!input) return
  const { webhookSecret } = input
  await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: {
      webhookSecretEnc: encryptWebhookSecret(webhookSecret),
      webhookTestToken: null,
      webhookTestStartedAt: null,
      webhookVerifiedAt: null,
    },
  })
  res.json({ connected: true })
})

function payloadRecipients(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const body = payload as Record<string, unknown>
  const data = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : body
  const to = data.to
  if (Array.isArray(to)) return to.filter((value): value is string => typeof value === 'string').map(value => value.toLowerCase())
  return typeof to === 'string' ? [to.toLowerCase()] : []
}

router.post('/me/resend/webhook-test/start', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!org?.resendVerifiedDomain || !org.webhookSecretEnc) {
    return res.status(400).json({ error: 'Configurez d’abord le domaine et le secret du webhook.' })
  }

  const token = crypto.randomBytes(8).toString('hex')
  const startedAt = new Date()
  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: { webhookTestToken: token, webhookTestStartedAt: startedAt, webhookVerifiedAt: null },
  })
  res.json({
    started: true,
    verified: false,
    testAddress: `setup+${token}@${updated.resendVerifiedDomain}`,
    startedAt,
    verifiedAt: null,
  })
})

router.get('/me/resend/webhook-test', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!org?.resendVerifiedDomain || !org.webhookSecretEnc) {
    return res.status(400).json({ error: 'Configurez d’abord le domaine et le secret du webhook.' })
  }

  const testAddress = org.webhookTestToken ? `setup+${org.webhookTestToken}@${org.resendVerifiedDomain}` : null
  if (org.webhookVerifiedAt) {
    return res.json({ started: true, verified: true, testAddress, startedAt: org.webhookTestStartedAt, verifiedAt: org.webhookVerifiedAt })
  }
  if (!org.webhookTestToken || !org.webhookTestStartedAt || !testAddress) {
    return res.json({ started: false, verified: false, testAddress: null, startedAt: null, verifiedAt: null })
  }

  const events = await prisma.inboundEvent.findMany({
    where: { organizationId: org.id, provider: 'resend', createdAt: { gte: org.webhookTestStartedAt } },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { createdAt: true, payload: true },
  })
  const matchingEvent = events.find(event =>
    payloadRecipients(event.payload).some(recipient => recipient.includes(testAddress.toLowerCase()))
  )
  if (!matchingEvent) {
    return res.json({ started: true, verified: false, testAddress, startedAt: org.webhookTestStartedAt, verifiedAt: null })
  }

  const verified = await prisma.organization.update({
    where: { id: org.id },
    data: { webhookVerifiedAt: matchingEvent.createdAt },
    select: { webhookVerifiedAt: true },
  })
  res.json({
    started: true,
    verified: true,
    testAddress,
    startedAt: org.webhookTestStartedAt,
    verifiedAt: verified.webhookVerifiedAt,
  })
})

// Rotation en cas de fuite du token : l'ancienne URL de webhook devient
// immédiatement invalide (404), l'org doit la remettre à jour côté Resend.
router.post('/me/resend/regenerate-webhook-token', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const org = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: {
      webhookToken: generateWebhookToken(),
      webhookTestToken: null,
      webhookTestStartedAt: null,
      webhookVerifiedAt: null,
    },
  })
  res.json({ webhookUrl: webhookUrlFor(org.webhookToken) })
})

// Export de la configuration mail (domaine, alias, règles de routage, modèles
// de réponse) — pour reprendre la même config dans une autre app utilisant
// Resend. Volontairement sans secrets (clé API Resend, secret webhook) : à
// ressaisir manuellement côté app cible plutôt que de les faire circuler dans
// un fichier téléchargeable.
router.get('/me/export', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!org) return res.status(404).json({ error: 'Organisation introuvable.' })

  const db = forOrg(req.user!.organizationId)
  const [users, mailRoutes, routingRules, replyTemplates] = await Promise.all([
    db.user.findMany({ orderBy: { username: 'asc' } }),
    db.mailRoute.findMany({ orderBy: { alias: 'asc' } }),
    db.threadRoutingRule.findMany({ include: { assignTo: { select: { email: true } } }, orderBy: { canal: 'asc' } }),
    db.replyTemplate.findMany({ orderBy: { titre: 'asc' } }),
  ])

  let csv = '﻿'
  csv += csvRow(['Section', 'Domaine'])
  csv += csvRow(['domain'])
  csv += csvRow([org.resendVerifiedDomain || ''])
  csv += '\r\n'

  // Jamais le mot de passe — un utilisateur réimporté ailleurs redevient une
  // invitation PENDING, jamais un compte directement utilisable (voir /me/import).
  csv += csvRow(['Section', 'Users'])
  csv += csvRow(['username', 'email', 'nom', 'proEmail', 'orgRole', 'isDeptHead'])
  for (const u of users) csv += csvRow([u.username, u.email, u.nom, u.proEmail || '', u.orgRole, u.isDeptHead])
  csv += '\r\n'

  csv += csvRow(['Section', 'Mail Routes'])
  csv += csvRow(['alias', 'personalEmail', 'displayName', 'active'])
  for (const r of mailRoutes) csv += csvRow([r.alias, r.personalEmail, r.displayName || '', r.active])
  csv += '\r\n'

  csv += csvRow(['Section', 'Routing Rules'])
  csv += csvRow(['canal', 'assignToEmail', 'active'])
  for (const r of routingRules) csv += csvRow([r.canal, r.assignTo?.email || '', r.active])
  csv += '\r\n'

  csv += csvRow(['Section', 'Reply Templates'])
  csv += csvRow(['titre', 'canal', 'corps'])
  for (const t of replyTemplates) csv += csvRow([t.titre, t.canal || '', t.corps])

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="config-mail-${org.slug}.csv"`)
  res.send(csv)
})

// Réimport du CSV produit par /me/export (même architecture — voir
// docs/export-import-config-mail.md §3, "Cas A"). Upsert par clé métier (alias /
// canal / titre+canal) plutôt que remplacement complet : rejouer un import ne doit
// ni dupliquer ni supprimer ce qui existe déjà côté cible. Le domaine n'est jamais
// appliqué automatiquement (§3 : "à titre indicatif") — seulement renvoyé pour
// affichage, l'admin le reconfigure via Réglages → Connexion Resend si besoin.
//
// Migration d'un environnement existant : un assignToEmail sans User correspondant
// est "staged" plutôt qu'ignoré si une invitation PENDING existe (créée par la
// section Users de ce même import, ou déjà créée à la main) — la règle de routage
// et le sender grant sont posés sur l'invitation et appliqués automatiquement à
// l'activation (voir routes/publicUserInvites.ts). Une invitation ne donne par
// elle-même aucun accès : le fichier et le code restent deux actions séparées.
router.post('/me/import', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), configImportUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier CSV requis.' })

  let parsed: ReturnType<typeof parseConfigImport>
  try {
    parsed = parseConfigImport(req.file.buffer.toString('utf-8'))
  } catch {
    return res.status(400).json({ error: 'Fichier CSV illisible.' })
  }

  if (
    parsed.users.length > 500 ||
    parsed.mailRoutes.length > 500 ||
    parsed.routingRules.length > 500 ||
    parsed.replyTemplates.length > 500
  ) {
    return res.status(400).json({ error: '500 lignes maximum par section.' })
  }

  const db = forOrg(req.user!.organizationId)
  const organizationId = req.user!.organizationId
  const grantedBy = req.user!.nom || req.user!.username
  const configuredOrg = await prisma.organization.findUnique({ where: { id: organizationId }, select: { resendVerifiedDomain: true } })
  const configuredDomain = configuredOrg?.resendVerifiedDomain?.toLowerCase() ?? null

  const usersResult = { created: 0, reused: 0, skipped: [] as { key: string; reason: string }[] }
  const seenUserKeys = new Set<string>()
  for (const u of parsed.users as ImportedUser[]) {
    if (!canCreateOrgRole(req.user!.orgRole, u.orgRole)) {
      usersResult.skipped.push({ key: u.email, reason: "rôle non autorisé pour l'importateur" })
      continue
    }
    if (seenUserKeys.has(u.email) || seenUserKeys.has(u.username)) {
      usersResult.skipped.push({ key: u.email, reason: 'doublon dans le fichier' })
      continue
    }
    seenUserKeys.add(u.email)
    seenUserKeys.add(u.username)

    // Vérif globale (comme POST /user-invites) : username/email sont uniques sur
    // toute la plateforme, pas seulement dans cette organisation.
    const existingUser = await prisma.user.findFirst({ where: { OR: [{ username: u.username }, { email: u.email }] } })
    if (existingUser) {
      usersResult.skipped.push({ key: u.email, reason: 'utilisateur déjà existant' })
      continue
    }

    const existingInviteHere = await db.userInvite.findFirst({ where: { email: u.email, status: 'PENDING' } })
    if (existingInviteHere) {
      usersResult.reused++
      continue
    }

    const conflictingInvite = await prisma.userInvite.findFirst({
      where: { status: 'PENDING', OR: [{ username: u.username }, { email: u.email }] },
    })
    if (conflictingInvite) {
      usersResult.skipped.push({ key: u.email, reason: "nom d'utilisateur ou email déjà utilisé par une invitation en attente" })
      continue
    }

    await db.userInvite.create({
      data: {
        organizationId,
        username: u.username,
        email: u.email,
        nom: u.nom,
        proEmail: u.proEmail || null,
        orgRole: u.orgRole,
        isDeptHead: u.isDeptHead,
        expiresAt: new Date(Date.now() + INVITE_HYGIENE_TTL_MS),
        createdById: req.user!.id,
      },
    })
    usersResult.created++
  }

  const mailRoutesResult = { created: 0, updated: 0, skipped: [] as { key: string; reason: string }[] }
  const seenAliases = new Set<string>()
  for (const r of parsed.mailRoutes as ImportedMailRoute[]) {
    if (seenAliases.has(r.alias)) {
      mailRoutesResult.skipped.push({ key: r.alias, reason: 'doublon dans le fichier' })
      continue
    }
    seenAliases.add(r.alias)
    const parsedRoute = mailRouteCreateSchema.safeParse(r)
    if (!parsedRoute.success) {
      mailRoutesResult.skipped.push({ key: r.alias, reason: 'alias ou personalEmail invalide' })
      continue
    }
    if (!configuredDomain) {
      mailRoutesResult.skipped.push({ key: r.alias, reason: 'aucun domaine Resend vérifié configuré' })
      continue
    }
    if (!emailBelongsToDomain(parsedRoute.data.alias, configuredDomain)) {
      mailRoutesResult.skipped.push({ key: r.alias, reason: `alias hors du domaine ${configuredDomain}` })
      continue
    }
    const routeInput = parsedRoute.data
    const existing = await db.mailRoute.findFirst({ where: { alias: routeInput.alias } })
    if (existing) {
      await db.mailRoute.update({
        where: { id: existing.id },
        data: {
          personalEmail: routeInput.personalEmail ?? '',
          displayName: routeInput.displayName || null,
          active: routeInput.active ?? true,
        },
      })
      mailRoutesResult.updated++
    } else {
      await db.mailRoute.create({
        data: {
          organizationId,
          alias: routeInput.alias,
          personalEmail: routeInput.personalEmail ?? '',
          displayName: routeInput.displayName || null,
          active: routeInput.active ?? true,
        },
      })
      mailRoutesResult.created++
    }
  }

  // canal ↔ alias : le canal d'un thread est dérivé du local-part de l'alias qui l'a
  // reçu (`toAddr.split('@')[0]`, voir routes/mail.ts) — donc à partir du canal d'une
  // Routing Rule on peut retrouver l'alias Mail Route correspondant, déjà importé
  // ci-dessus, pour savoir quelle adresse accorder en SenderGrant.
  const allRoutes = await db.mailRoute.findMany()
  const aliasByCanal = new Map(allRoutes.map(r => [r.alias.split('@')[0].toLowerCase(), r.alias]))

  const routingRulesResult = { created: 0, updated: 0, staged: 0, skipped: [] as { key: string; reason: string }[] }
  const seenCanaux = new Set<string>()
  for (const r of parsed.routingRules as ImportedRoutingRule[]) {
    if (seenCanaux.has(r.canal)) {
      routingRulesResult.skipped.push({ key: r.canal, reason: 'doublon dans le fichier' })
      continue
    }
    seenCanaux.add(r.canal)
    if (!r.assignToEmail) {
      routingRulesResult.skipped.push({ key: r.canal, reason: 'assignToEmail manquant' })
      continue
    }
    const alias = aliasByCanal.get(r.canal)

    const user = await db.user.findFirst({ where: { email: r.assignToEmail } })
    if (user) {
      const existing = await db.threadRoutingRule.findFirst({ where: { canal: r.canal } })
      if (existing) {
        await db.threadRoutingRule.update({ where: { id: existing.id }, data: { assignToId: user.id, active: r.active } })
        routingRulesResult.updated++
      } else {
        await db.threadRoutingRule.create({ data: { organizationId, canal: r.canal, assignToId: user.id, active: r.active } })
        routingRulesResult.created++
      }
      // Un OWNER/ADMIN a déjà accès à tous les alias sans SenderGrant explicite
      // (voir helpers/senders.ts) — inutile d'en créer un, jamais lu pour ces rôles.
      if (alias && user.orgRole === 'MEMBER') {
        const existingGrant = await db.senderGrant.findFirst({ where: { userId: user.id, email: alias } })
        if (!existingGrant) await db.senderGrant.create({ data: { organizationId, userId: user.id, email: alias, grantedBy } })
      }
      continue
    }

    const invite = await db.userInvite.findFirst({ where: { email: r.assignToEmail, status: 'PENDING' } })
    if (invite) {
      const canaux = new Set<string>(invite.pendingRoutingCanaux ? JSON.parse(invite.pendingRoutingCanaux) : [])
      canaux.add(r.canal)
      const senders = new Set<string>(invite.pendingSenderEmails ? JSON.parse(invite.pendingSenderEmails) : [])
      if (alias) senders.add(alias)
      await db.userInvite.update({
        where: { id: invite.id },
        data: { pendingRoutingCanaux: JSON.stringify([...canaux]), pendingSenderEmails: JSON.stringify([...senders]) },
      })
      routingRulesResult.staged++
      continue
    }

    routingRulesResult.skipped.push({ key: r.canal, reason: `utilisateur ${r.assignToEmail} introuvable dans cette organisation` })
  }

  const replyTemplatesResult = { created: 0, updated: 0 }
  for (const t of parsed.replyTemplates as ImportedReplyTemplate[]) {
    const existing = await db.replyTemplate.findFirst({ where: { titre: t.titre, canal: t.canal || null } })
    if (existing) {
      await db.replyTemplate.update({ where: { id: existing.id }, data: { corps: t.corps } })
      replyTemplatesResult.updated++
    } else {
      await db.replyTemplate.create({ data: { organizationId, titre: t.titre, canal: t.canal || null, corps: t.corps } })
      replyTemplatesResult.created++
    }
  }

  res.json({
    domain: parsed.domain,
    users: usersResult,
    mailRoutes: mailRoutesResult,
    routingRules: routingRulesResult,
    replyTemplates: replyTemplatesResult,
  })
})

export default router
