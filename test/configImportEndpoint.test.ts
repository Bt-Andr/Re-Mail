import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { csvRow } from '../src/lib/csv'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

interface CsvUser {
  username: string
  email: string
  nom: string
  proEmail?: string
  orgRole?: string
  isDeptHead?: string
}

function buildCsv(opts: { domain?: string; assignToEmail?: string; users?: CsvUser[] }) {
  let csv = '﻿'
  csv += csvRow(['Section', 'Domaine'])
  csv += csvRow(['domain'])
  csv += csvRow([opts.domain ?? 'imported.example'])
  csv += '\r\n'
  csv += csvRow(['Section', 'Users'])
  csv += csvRow(['username', 'email', 'nom', 'proEmail', 'orgRole', 'isDeptHead'])
  for (const u of opts.users ?? []) {
    csv += csvRow([u.username, u.email, u.nom, u.proEmail ?? '', u.orgRole ?? 'MEMBER', u.isDeptHead ?? 'false'])
  }
  csv += '\r\n'
  csv += csvRow(['Section', 'Mail Routes'])
  csv += csvRow(['alias', 'personalEmail', 'displayName', 'active'])
  csv += csvRow(['contact@imported.example', 'perso@example.com', 'Contact', 'true'])
  csv += '\r\n'
  csv += csvRow(['Section', 'Routing Rules'])
  csv += csvRow(['canal', 'assignToEmail', 'active'])
  csv += csvRow(['contact', opts.assignToEmail ?? '', 'true'])
  csv += '\r\n'
  csv += csvRow(['Section', 'Reply Templates'])
  csv += csvRow(['titre', 'canal', 'corps'])
  csv += csvRow(['Bienvenue', '', 'Bonjour et merci.'])
  return Buffer.from(csv, 'utf-8')
}

describe('POST /api/organizations/me/import', () => {
  let orgA: SeededOrg
  let orgB: SeededOrg
  let orgAOwnerEmail: string
  let orgAMemberId: string
  let orgAMemberEmail: string

  beforeAll(async () => {
    orgA = await seedOrg('import-a')
    orgB = await seedOrg('import-b')
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: orgA.userId } })
    orgAOwnerEmail = owner.email

    const member = await prisma.user.create({
      data: {
        organizationId: orgA.organizationId,
        username: `import-member-${Date.now()}`,
        email: `import-member-${Date.now()}@test-co.example`,
        password: 'irrelevant',
        nom: 'Membre Import',
        orgRole: 'MEMBER',
      },
    })
    orgAMemberId = member.id
    orgAMemberEmail = member.email
  })

  afterAll(async () => {
    await cleanupOrg(orgA.organizationId)
    await cleanupOrg(orgB.organizationId)
  })

  it('creates mail routes, resolves routing rule assignee, creates reply templates, and never applies the domain', async () => {
    const res = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${orgA.token}`)
      .attach('file', buildCsv({ assignToEmail: orgAMemberEmail }), 'config.csv')

    expect(res.status).toBe(200)
    expect(res.body.domain).toBe('imported.example')
    expect(res.body.users).toEqual({ created: 0, reused: 0, skipped: [] })
    expect(res.body.mailRoutes).toEqual({ created: 1, updated: 0, skipped: [] })
    expect(res.body.routingRules).toEqual({ created: 1, updated: 0, staged: 0, skipped: [] })
    expect(res.body.replyTemplates).toEqual({ created: 1, updated: 0 })

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.organizationId } })
    expect(org.resendVerifiedDomain).not.toBe('imported.example')

    const route = await prisma.mailRoute.findFirstOrThrow({ where: { organizationId: orgA.organizationId, alias: 'contact@imported.example' } })
    expect(route.personalEmail).toBe('perso@example.com')

    const rule = await prisma.threadRoutingRule.findFirstOrThrow({ where: { organizationId: orgA.organizationId, canal: 'contact' } })
    expect(rule.assignToId).toBe(orgAMemberId)

    const grant = await prisma.senderGrant.findFirstOrThrow({ where: { organizationId: orgA.organizationId, userId: orgAMemberId, email: 'contact@imported.example' } })
    expect(grant.email).toBe('contact@imported.example')
  })

  it('is idempotent: re-importing the same file updates instead of duplicating', async () => {
    const res = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${orgA.token}`)
      .attach('file', buildCsv({ assignToEmail: orgAMemberEmail }), 'config.csv')

    expect(res.status).toBe(200)
    expect(res.body.mailRoutes).toEqual({ created: 0, updated: 1, skipped: [] })
    expect(res.body.routingRules).toEqual({ created: 0, updated: 1, staged: 0, skipped: [] })
    expect(res.body.replyTemplates).toEqual({ created: 0, updated: 1 })

    const routes = await prisma.mailRoute.findMany({ where: { organizationId: orgA.organizationId, alias: 'contact@imported.example' } })
    expect(routes).toHaveLength(1)

    // Le sender grant posé au premier import n'est pas dupliqué au second.
    const grants = await prisma.senderGrant.findMany({ where: { organizationId: orgA.organizationId, userId: orgAMemberId, email: 'contact@imported.example' } })
    expect(grants).toHaveLength(1)
  })

  it('never creates a SenderGrant for an OWNER/ADMIN assignee — they already have implicit access to every alias', async () => {
    const res = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${orgA.token}`)
      .attach('file', buildCsv({ assignToEmail: orgAOwnerEmail, domain: 'owner-case.example' }), 'config.csv')

    expect(res.status).toBe(200)
    const rule = await prisma.threadRoutingRule.findFirstOrThrow({ where: { organizationId: orgA.organizationId, canal: 'contact' } })
    expect(rule.assignToId).toBe(orgA.userId)

    const grant = await prisma.senderGrant.findFirst({ where: { organizationId: orgA.organizationId, userId: orgA.userId, email: 'contact@imported.example' } })
    expect(grant).toBeNull()
  })

  it('normalizes the canal to lowercase so a hand-authored CSV with mixed case still matches the mail route and real inbound threads', async () => {
    let csv = '﻿'
    csv += csvRow(['Section', 'Domaine']) + csvRow(['domain']) + csvRow(['']) + '\r\n'
    csv += csvRow(['Section', 'Users']) + csvRow(['username', 'email', 'nom', 'proEmail', 'orgRole', 'isDeptHead']) + '\r\n'
    csv += csvRow(['Section', 'Mail Routes']) + csvRow(['alias', 'personalEmail', 'displayName', 'active'])
    csv += csvRow(['support@mixedcase.example', '', '', 'true']) + '\r\n'
    csv += csvRow(['Section', 'Routing Rules']) + csvRow(['canal', 'assignToEmail', 'active'])
    csv += csvRow(['Support', orgAMemberEmail, 'true']) + '\r\n'
    csv += csvRow(['Section', 'Reply Templates']) + csvRow(['titre', 'canal', 'corps'])

    const res = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${orgA.token}`)
      .attach('file', Buffer.from(csv, 'utf-8'), 'config.csv')

    expect(res.status).toBe(200)
    expect(res.body.routingRules).toEqual({ created: 1, updated: 0, staged: 0, skipped: [] })

    const rule = await prisma.threadRoutingRule.findFirstOrThrow({ where: { organizationId: orgA.organizationId, canal: 'support' } })
    expect(rule.canal).toBe('support')

    const grant = await prisma.senderGrant.findFirstOrThrow({ where: { organizationId: orgA.organizationId, userId: orgAMemberId, email: 'support@mixedcase.example' } })
    expect(grant.email).toBe('support@mixedcase.example')
  })

  it('skips a routing rule whose assignToEmail belongs to another organization', async () => {
    const ownerB = await prisma.user.findUniqueOrThrow({ where: { id: orgB.userId } })
    const res = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${orgA.token}`)
      .attach('file', buildCsv({ assignToEmail: ownerB.email }), 'config.csv')

    expect(res.status).toBe(200)
    expect(res.body.routingRules.created + res.body.routingRules.updated + res.body.routingRules.staged).toBe(0)
    expect(res.body.routingRules.skipped).toEqual([
      { key: 'contact', reason: `utilisateur ${ownerB.email} introuvable dans cette organisation` },
    ])
  })

  it('rejects the request without a file', async () => {
    const res = await request(app).post('/api/organizations/me/import').set('Authorization', `Bearer ${orgA.token}`)
    expect(res.status).toBe(400)
  })

  it('rejects members without OWNER/ADMIN role', async () => {
    const member = await prisma.user.create({
      data: {
        organizationId: orgA.organizationId,
        username: `member-${Date.now()}`,
        email: `member-${Date.now()}@test-co.example`,
        password: 'irrelevant',
        nom: 'Membre Test',
        orgRole: 'MEMBER',
      },
    })
    const jwt = await import('jsonwebtoken')
    const config = (await import('../src/config')).default
    const token = jwt.sign(
      { id: member.id, organizationId: orgA.organizationId, username: member.username, orgRole: member.orgRole, nom: member.nom },
      config.jwtSecret,
      { expiresIn: '1h' }
    )

    const res = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buildCsv({}), 'config.csv')

    expect(res.status).toBe(403)
  })

  describe('Users section — pending invitations for migration', () => {
    it('creates a PENDING invite for an unknown user, and stages the routing rule + sender grant on it instead of skipping', async () => {
      const email = `migrated-${Date.now()}@legacy.example`
      const res = await request(app)
        .post('/api/organizations/me/import')
        .set('Authorization', `Bearer ${orgA.token}`)
        .attach(
          'file',
          buildCsv({ assignToEmail: email, users: [{ username: `migrated-${Date.now()}`, email, nom: 'Personne Migrée' }] }),
          'config.csv'
        )

      expect(res.status).toBe(200)
      expect(res.body.users).toEqual({ created: 1, reused: 0, skipped: [] })
      expect(res.body.routingRules.staged).toBe(1)
      expect(res.body.routingRules.skipped).toEqual([])

      const invite = await prisma.userInvite.findFirstOrThrow({ where: { organizationId: orgA.organizationId, email, status: 'PENDING' } })
      expect(JSON.parse(invite.pendingRoutingCanaux ?? '[]')).toEqual(['contact'])
      expect(JSON.parse(invite.pendingSenderEmails ?? '[]')).toEqual(['contact@imported.example'])

      // Aucun accès n'a été créé — pas de User, pas de secrets d'activation posés.
      const user = await prisma.user.findFirst({ where: { email } })
      expect(user).toBeNull()
      expect(invite.activationCodeHash).toBeNull()
    })

    it('reuses the existing PENDING invite on re-import instead of duplicating it', async () => {
      const email = `reimport-${Date.now()}@legacy.example`
      const username = `reimport-${Date.now()}`
      const csv = buildCsv({ users: [{ username, email, nom: 'Réimporté' }] })

      const first = await request(app).post('/api/organizations/me/import').set('Authorization', `Bearer ${orgA.token}`).attach('file', csv, 'config.csv')
      expect(first.body.users).toEqual({ created: 1, reused: 0, skipped: [] })

      const second = await request(app).post('/api/organizations/me/import').set('Authorization', `Bearer ${orgA.token}`).attach('file', csv, 'config.csv')
      expect(second.body.users).toEqual({ created: 0, reused: 1, skipped: [] })

      const invites = await prisma.userInvite.findMany({ where: { organizationId: orgA.organizationId, email } })
      expect(invites).toHaveLength(1)
    })

    it('skips a Users row whose email already belongs to an existing account', async () => {
      const res = await request(app)
        .post('/api/organizations/me/import')
        .set('Authorization', `Bearer ${orgA.token}`)
        .attach('file', buildCsv({ users: [{ username: `dup-${Date.now()}`, email: orgAOwnerEmail, nom: 'Doublon' }] }), 'config.csv')

      expect(res.status).toBe(200)
      expect(res.body.users).toEqual({ created: 0, reused: 0, skipped: [{ key: orgAOwnerEmail, reason: 'utilisateur déjà existant' }] })

      const invite = await prisma.userInvite.findFirst({ where: { organizationId: orgA.organizationId, email: orgAOwnerEmail } })
      expect(invite).toBeNull()
    })
  })
})
