import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

describe('Tenant isolation', () => {
  let orgA: SeededOrg
  let orgB: SeededOrg

  beforeAll(async () => {
    orgA = await seedOrg('tenant-a')
    orgB = await seedOrg('tenant-b')
  })

  afterAll(async () => {
    await cleanupOrg(orgA.organizationId)
    await cleanupOrg(orgB.organizationId)
  })

  it('does not let org B see org A\'s mail routes', async () => {
    const created = await request(app)
      .post('/api/mail-routes')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ alias: 'contact@org-a.example', personalEmail: 'perso@example.com' })
    expect(created.status).toBe(201)

    const listB = await request(app).get('/api/mail-routes').set('Authorization', `Bearer ${orgB.token}`)
    expect(listB.status).toBe(200)
    expect(listB.body).toEqual([])

    // Org B ne peut pas modifier une route qui appartient à org A, même en connaissant son id
    const updateB = await request(app)
      .put(`/api/mail-routes/${created.body.id}`)
      .set('Authorization', `Bearer ${orgB.token}`)
      .send({ alias: 'hijacked@org-a.example', personalEmail: 'attacker@example.com' })
    expect(updateB.status).toBe(404)

    // La route d'origine n'a pas été modifiée
    const untouched = await prisma.mailRoute.findUnique({ where: { id: created.body.id } })
    expect(untouched?.alias).toBe('contact@org-a.example')
  })

  it('does not let org B see or touch org A\'s reply templates', async () => {
    const created = await request(app)
      .post('/api/reply-templates')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ titre: 'Modèle A', corps: 'Bonjour...' })
    expect(created.status).toBe(200)

    const listB = await request(app).get('/api/reply-templates').set('Authorization', `Bearer ${orgB.token}`)
    expect(listB.body).toEqual([])

    const deleteB = await request(app)
      .delete(`/api/reply-templates/${created.body.id}`)
      .set('Authorization', `Bearer ${orgB.token}`)
    expect(deleteB.status).toBe(404)
  })

  it('does not let org B see org A\'s threads, even by guessing the id', async () => {
    const thread = await prisma.thread.create({
      data: {
        organizationId: orgA.organizationId,
        canal: 'contact',
        sujet: 'Sujet confidentiel org A',
        externalFrom: 'Client A',
        externalEmail: 'client@a.example',
        origin: 'inbound',
      },
    })

    const listB = await request(app).get('/api/threads').set('Authorization', `Bearer ${orgB.token}`)
    expect(listB.body.find((t: { id: string }) => t.id === thread.id)).toBeUndefined()

    const getB = await request(app).get(`/api/threads/${thread.id}`).set('Authorization', `Bearer ${orgB.token}`)
    expect(getB.status).toBe(404)

    const getA = await request(app).get(`/api/threads/${thread.id}`).set('Authorization', `Bearer ${orgA.token}`)
    expect(getA.status).toBe(200)
    expect(getA.body.sujet).toBe('Sujet confidentiel org A')

    const replyB = await request(app)
      .post('/api/emails/reply')
      .set('Authorization', `Bearer ${orgB.token}`)
      .send({ threadId: thread.id, to: 'recipient@example.com', subject: 'Re', message: 'Tentative' })
    expect(replyB.status).toBe(404)
  })

  it('does not let org B assign org A\'s thread to one of its own users', async () => {
    const thread = await prisma.thread.create({
      data: {
        organizationId: orgA.organizationId,
        canal: 'contact',
        sujet: 'Autre sujet org A',
        externalFrom: 'Client A2',
        externalEmail: 'client2@a.example',
        origin: 'inbound',
      },
    })

    const assignB = await request(app)
      .patch(`/api/threads/${thread.id}/assign`)
      .set('Authorization', `Bearer ${orgB.token}`)
      .send({ assignedToId: orgB.userId })
    // La mise à jour scopée par organizationId ne trouve aucune ligne à modifier
    expect([404, 500]).toContain(assignB.status)

    const stillUnassigned = await prisma.thread.findUnique({ where: { id: thread.id } })
    expect(stillUnassigned?.assignedToId).toBeNull()
  })

  it('does not let an org A manager assign an org A thread to an org B user', async () => {
    const thread = await prisma.thread.create({
      data: {
        organizationId: orgA.organizationId,
        canal: 'contact',
        sujet: 'Affectation inter-tenant',
        externalFrom: 'Client A3',
        externalEmail: 'client3@a.example',
        origin: 'inbound',
      },
    })

    const response = await request(app)
      .patch(`/api/threads/${thread.id}/assign`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ assignedToId: orgB.userId })

    expect(response.status).toBe(400)
    const unchanged = await prisma.thread.findUnique({ where: { id: thread.id } })
    expect(unchanged?.assignedToId).toBeNull()
  })

  it('does not let an org A routing rule reference an org B user', async () => {
    const response = await request(app)
      .put('/api/thread-routing-rules/finance')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ assignToId: orgB.userId, active: true })

    expect(response.status).toBe(400)
    expect(await prisma.threadRoutingRule.findFirst({ where: { organizationId: orgA.organizationId, canal: 'finance' } })).toBeNull()
  })

  it('does not let an org A sender grant reference an org B user', async () => {
    const alias = `shared-${Date.now()}@org-a.example`
    await prisma.mailRoute.create({
      data: { organizationId: orgA.organizationId, alias, personalEmail: 'owner@org-a.example', active: true },
    })

    const response = await request(app)
      .post(`/api/users/${orgB.userId}/sender-grants`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ email: alias })

    expect(response.status).toBe(404)
    expect(await prisma.senderGrant.findFirst({ where: { organizationId: orgA.organizationId, userId: orgB.userId } })).toBeNull()
  })

  it('forOrg() extension never leaks rows across organizations even without an explicit where', async () => {
    const { forOrg } = await import('../src/middleware/scopedPrisma')
    const dbA = forOrg(orgA.organizationId)
    const rows = await dbA.mailRoute.findMany()
    expect(rows.every(r => r.organizationId === orgA.organizationId)).toBe(true)
    expect(rows.some(r => r.organizationId === orgB.organizationId)).toBe(false)
  })
})
