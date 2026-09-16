import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { cleanupOrg, seedOrg, type SeededOrg } from './helpers/seed'

describe('Configuration route validation and HTTP semantics', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('configuration-routes')
  })

  beforeEach(async () => {
    await prisma.threadRoutingRule.deleteMany({ where: { organizationId: org.organizationId } })
    await prisma.replyTemplate.deleteMany({ where: { organizationId: org.organizationId } })
    await prisma.mailDraft.deleteMany({ where: { organizationId: org.organizationId } })
    await prisma.mailRoute.deleteMany({ where: { organizationId: org.organizationId } })
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('rejects a malformed organization profile without partially updating it', async () => {
    const before = await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })
    const response = await request(app)
      .put('/api/organizations/me')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ name: 'Nouveau nom', emailContact: { address: 'contact@example.com' } })

    expect(response.status).toBe(400)
    const after = await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })
    expect(after.name).toBe(before.name)
    expect(after.emailContact).toBe(before.emailContact)
  })

  it('normalizes valid organization profile values', async () => {
    const response = await request(app)
      .put('/api/organizations/me')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ name: '  Équipe Support  ', companyName: '  ACME  ', emailContact: ' CONTACT@EXAMPLE.COM ' })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      name: 'Équipe Support',
      companyName: 'ACME',
      emailContact: 'contact@example.com',
    })
  })

  it('rejects ambiguous or mistyped routing assignments before writing', async () => {
    const mistyped = await request(app)
      .put('/api/thread-routing-rules/support')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ assignToId: org.userId, active: 'true' })
    expect(mistyped.status).toBe(400)

    const ambiguous = await request(app)
      .put('/api/thread-routing-rules/support')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ assignToId: org.userId, assignToEmail: 'owner@example.com' })
    expect(ambiguous.status).toBe(400)
    expect(await prisma.threadRoutingRule.count({ where: { organizationId: org.organizationId } })).toBe(0)
  })

  it('normalizes the routing canal and returns a real 404 only for a missing rule', async () => {
    const created = await request(app)
      .put('/api/thread-routing-rules/SALES')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ assignToId: org.userId })
    expect(created.status).toBe(200)
    expect(created.body.canal).toBe('sales')

    const missing = await request(app)
      .delete('/api/thread-routing-rules/unknown')
      .set('Authorization', `Bearer ${org.token}`)
    expect(missing.status).toBe(404)
  })

  it('validates reply-template writes and uses 201 for creation', async () => {
    const invalid = await request(app)
      .post('/api/reply-templates')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ titre: 42, corps: 'Bonjour' })
    expect(invalid.status).toBe(400)

    const created = await request(app)
      .post('/api/reply-templates')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ titre: '  Bienvenue  ', corps: '  Bonjour !  ', canal: ' SUPPORT ' })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ titre: 'Bienvenue', corps: 'Bonjour !', canal: 'support' })
  })

  it('rejects malformed template queries and returns 404 for a missing model', async () => {
    const malformedQuery = await request(app)
      .get('/api/reply-templates?canal=sales&canal=support')
      .set('Authorization', `Bearer ${org.token}`)
    expect(malformedQuery.status).toBe(400)

    const missing = await request(app)
      .put('/api/reply-templates/missing')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ titre: 'Titre', corps: 'Corps' })
    expect(missing.status).toBe(404)
  })

  it('keeps drafts permissive for incomplete text but rejects invalid types and sizes', async () => {
    const malformed = await request(app)
      .post('/api/drafts')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ subject: { text: 'Objet' } })
    expect(malformed.status).toBe(400)

    const oversized = await request(app)
      .post('/api/drafts')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ subject: 'x'.repeat(999) })
    expect(oversized.status).toBe(400)

    const valid = await request(app)
      .post('/api/drafts')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ subject: 'Brouillon incomplet' })
    expect(valid.status).toBe(201)
    expect(valid.body).toMatchObject({ toEmail: '', ccEmail: '', bccEmail: '', subject: 'Brouillon incomplet', body: '' })
  })

  it('rejects empty draft updates and preserves the stored draft', async () => {
    const draft = await prisma.mailDraft.create({
      data: { organizationId: org.organizationId, userId: org.userId, subject: 'Initial' },
    })
    const response = await request(app)
      .put(`/api/drafts/${draft.id}`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({})

    expect(response.status).toBe(400)
    const stored = await prisma.mailDraft.findUniqueOrThrow({ where: { id: draft.id } })
    expect(stored.subject).toBe('Initial')
  })

  it('returns 409 for an alias collision instead of reporting a false 404', async () => {
    await prisma.organization.update({
      where: { id: org.organizationId },
      data: { resendVerifiedDomain: 'mail.example.com' },
    })
    const first = await prisma.mailRoute.create({
      data: { organizationId: org.organizationId, alias: 'first@mail.example.com', personalEmail: '' },
    })
    const second = await prisma.mailRoute.create({
      data: { organizationId: org.organizationId, alias: 'second@mail.example.com', personalEmail: '' },
    })

    const response = await request(app)
      .put(`/api/mail-routes/${second.id}`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ alias: first.alias })
    expect(response.status).toBe(409)

    const stored = await prisma.mailRoute.findUniqueOrThrow({ where: { id: second.id } })
    expect(stored.alias).toBe('second@mail.example.com')
  })
})
