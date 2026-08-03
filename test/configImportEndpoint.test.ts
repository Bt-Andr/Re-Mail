import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { csvRow } from '../src/lib/csv'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

function buildCsv(opts: { domain?: string; assignToEmail?: string }) {
  let csv = '﻿'
  csv += csvRow(['Section', 'Domaine'])
  csv += csvRow(['domain'])
  csv += csvRow([opts.domain ?? 'imported.example'])
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

  beforeAll(async () => {
    orgA = await seedOrg('import-a')
    orgB = await seedOrg('import-b')
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: orgA.userId } })
    orgAOwnerEmail = owner.email
  })

  afterAll(async () => {
    await cleanupOrg(orgA.organizationId)
    await cleanupOrg(orgB.organizationId)
  })

  it('creates mail routes, resolves routing rule assignee, creates reply templates, and never applies the domain', async () => {
    const res = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${orgA.token}`)
      .attach('file', buildCsv({ assignToEmail: orgAOwnerEmail }), 'config.csv')

    expect(res.status).toBe(200)
    expect(res.body.domain).toBe('imported.example')
    expect(res.body.mailRoutes).toEqual({ created: 1, updated: 0, skipped: [] })
    expect(res.body.routingRules).toEqual({ created: 1, updated: 0, skipped: [] })
    expect(res.body.replyTemplates).toEqual({ created: 1, updated: 0 })

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.organizationId } })
    expect(org.resendVerifiedDomain).not.toBe('imported.example')

    const route = await prisma.mailRoute.findFirstOrThrow({ where: { organizationId: orgA.organizationId, alias: 'contact@imported.example' } })
    expect(route.personalEmail).toBe('perso@example.com')

    const rule = await prisma.threadRoutingRule.findFirstOrThrow({ where: { organizationId: orgA.organizationId, canal: 'contact' } })
    expect(rule.assignToId).toBe(orgA.userId)
  })

  it('is idempotent: re-importing the same file updates instead of duplicating', async () => {
    const res = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${orgA.token}`)
      .attach('file', buildCsv({ assignToEmail: orgAOwnerEmail }), 'config.csv')

    expect(res.status).toBe(200)
    expect(res.body.mailRoutes).toEqual({ created: 0, updated: 1, skipped: [] })
    expect(res.body.routingRules).toEqual({ created: 0, updated: 1, skipped: [] })
    expect(res.body.replyTemplates).toEqual({ created: 0, updated: 1 })

    const routes = await prisma.mailRoute.findMany({ where: { organizationId: orgA.organizationId, alias: 'contact@imported.example' } })
    expect(routes).toHaveLength(1)
  })

  it('skips a routing rule whose assignToEmail belongs to another organization', async () => {
    const ownerB = await prisma.user.findUniqueOrThrow({ where: { id: orgB.userId } })
    const res = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${orgA.token}`)
      .attach('file', buildCsv({ assignToEmail: ownerB.email }), 'config.csv')

    expect(res.status).toBe(200)
    expect(res.body.routingRules.created + res.body.routingRules.updated).toBe(0)
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
})
