import { Router } from 'express'
import prisma from '../lib/prisma'
import config from '../config'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import { forOrg } from '../middleware/scopedPrisma'
import { csvRow } from '../lib/csv'
import { parseConfigImport, ImportedUser, ImportedMailRoute, ImportedRoutingRule, ImportedReplyTemplate } from '../lib/configImport'
import { configImportUpload } from '../lib/upload'
import { INVITE_HYGIENE_TTL_MS } from './userInvites'
import {
  listResendDomains,
  encryptResendKey,
  encryptWebhookSecret,
  generateWebhookToken,
} from '../helpers/resendAccount'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const router = Router()

function webhookUrlFor(webhookToken: string): string {
  return `${config.backendUrl}/api/inbound-mail/${webhookToken}`
}

// Résumé d'onboarding : sert à afficher la checklist "Connecter Resend → coller
// l'URL de webhook → créer une route mail" dans le dashboard.
router.get('/me', authenticateToken, async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!org) return res.status(404).json({ error: 'Organisation introuvable.' })

  const mailRoutesCount = await prisma.mailRoute.count({ where: { organizationId: org.id } })

  res.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    companyName: org.companyName,
    emailContact: org.emailContact,
    resendConnected: !!org.resendApiKeyEnc,
    resendApiKeyLast4: org.resendApiKeyLast4,
    resendVerifiedDomain: org.resendVerifiedDomain,
    webhookConfigured: !!org.webhookSecretEnc,
    webhookUrl: webhookUrlFor(org.webhookToken),
    mailRoutesCount,
  })
})

router.put('/me', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { name, companyName, emailContact } = req.body
  const data: Record<string, unknown> = {}
  if (typeof name === 'string' && name.trim()) data.name = name.trim()
  if (typeof companyName === 'string') data.companyName = companyName.trim() || null
  if (typeof emailContact === 'string') data.emailContact = emailContact.trim() || null

  const org = await prisma.organization.update({ where: { id: req.user!.organizationId }, data })
  res.json({ id: org.id, name: org.name, companyName: org.companyName, emailContact: org.emailContact })
})

// Étape 1 : l'org colle sa clé API Resend — on la valide en listant ses domaines
// (401 => clé invalide) et on la stocke chiffrée. On renvoie aussi l'URL de
// webhook unique à coller côté Resend (Domaines → Inbound).
router.post('/me/resend/connect', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { apiKey } = req.body
  if (!apiKey || typeof apiKey !== 'string') return res.status(400).json({ error: 'apiKey requis.' })

  try {
    const domains = await listResendDomains(apiKey)
    const { enc, last4 } = encryptResendKey(apiKey)

    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { resendApiKeyEnc: enc, resendApiKeyLast4: last4, resendConnectedAt: new Date() },
    })

    res.json({
      verifiedDomains: domains.filter(d => d.status === 'verified').map(d => d.name),
      webhookUrl: webhookUrlFor(org.webhookToken),
    })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

router.post('/me/resend/select-domain', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { domain } = req.body
  if (!domain || typeof domain !== 'string') return res.status(400).json({ error: 'domain requis.' })
  const org = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: { resendVerifiedDomain: domain.trim() },
  })
  res.json({ resendVerifiedDomain: org.resendVerifiedDomain })
})

// Étape manuelle : Resend n'expose pas le secret de signature d'un webhook via
// API — l'org le colle elle-même après l'avoir créé dans son propre dashboard.
router.post('/me/resend/webhook-secret', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { webhookSecret } = req.body
  if (!webhookSecret || typeof webhookSecret !== 'string') {
    return res.status(400).json({ error: 'webhookSecret requis.' })
  }
  await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: { webhookSecretEnc: encryptWebhookSecret(webhookSecret) },
  })
  res.json({ connected: true })
})

// Rotation en cas de fuite du token : l'ancienne URL de webhook devient
// immédiatement invalide (404), l'org doit la remettre à jour côté Resend.
router.post('/me/resend/regenerate-webhook-token', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const org = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: { webhookToken: generateWebhookToken() },
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

  const usersResult = { created: 0, reused: 0, skipped: [] as { key: string; reason: string }[] }
  const seenUserKeys = new Set<string>()
  for (const u of parsed.users as ImportedUser[]) {
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
    if (r.personalEmail && !EMAIL_RE.test(r.personalEmail)) {
      mailRoutesResult.skipped.push({ key: r.alias, reason: 'personalEmail invalide' })
      continue
    }
    const existing = await db.mailRoute.findFirst({ where: { alias: r.alias } })
    if (existing) {
      await db.mailRoute.update({
        where: { id: existing.id },
        data: { personalEmail: r.personalEmail, displayName: r.displayName || null, active: r.active },
      })
      mailRoutesResult.updated++
    } else {
      await db.mailRoute.create({
        data: { organizationId, alias: r.alias, personalEmail: r.personalEmail, displayName: r.displayName || null, active: r.active },
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
      if (alias) {
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
