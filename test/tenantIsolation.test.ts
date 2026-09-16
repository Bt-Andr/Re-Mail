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
    await prisma.organization.update({ where: { id: orgA.organizationId }, data: { resendVerifiedDomain: 'org-a.example' } })
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

    const deleteB = await request(app)
      .delete(`/api/mail-routes/${created.body.id}`)
      .set('Authorization', `Bearer ${orgB.token}`)
    expect(deleteB.status).toBe(404)

    // La route d'origine n'a pas été modifiée
    const untouched = await prisma.mailRoute.findUnique({ where: { id: created.body.id } })
    expect(untouched?.alias).toBe('contact@org-a.example')
  })

  it('does not let org B see or touch org A\'s reply templates', async () => {
    const created = await request(app)
      .post('/api/reply-templates')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ titre: 'Modèle A', corps: 'Bonjour...' })
    expect(created.status).toBe(201)

    const listB = await request(app).get('/api/reply-templates').set('Authorization', `Bearer ${orgB.token}`)
    expect(listB.body).toEqual([])

    const updateB = await request(app)
      .put(`/api/reply-templates/${created.body.id}`)
      .set('Authorization', `Bearer ${orgB.token}`)
      .send({ titre: 'Modèle détourné', corps: 'Contenu détourné' })
    expect(updateB.status).toBe(404)

    const deleteB = await request(app)
      .delete(`/api/reply-templates/${created.body.id}`)
      .set('Authorization', `Bearer ${orgB.token}`)
    expect(deleteB.status).toBe(404)

    const untouched = await prisma.replyTemplate.findUnique({ where: { id: created.body.id } })
    expect(untouched?.titre).toBe('Modèle A')
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

  it('does not let org B mutate org A threads through individual or bulk endpoints', async () => {
    const thread = await prisma.thread.create({
      data: {
        organizationId: orgA.organizationId,
        canal: 'contact',
        sujet: 'Fil protégé org A',
        externalFrom: 'Client protégé',
        externalEmail: 'protected@a.example',
        origin: 'inbound',
      },
    })
    const auth = { Authorization: `Bearer ${orgB.token}` }
    const mutations = [
      { suffix: 'status', body: { status: 'resolu' } },
      { suffix: 'unread' },
      { suffix: 'trash' },
      { suffix: 'archive' },
      { suffix: 'unarchive' },
      { suffix: 'star', body: { starred: true } },
      { suffix: 'restore' },
    ] as const

    for (const mutation of mutations) {
      const response = await request(app)
        .patch(`/api/threads/${thread.id}/${mutation.suffix}`)
        .set(auth)
        .send('body' in mutation ? mutation.body : undefined)
      expect(response.status, mutation.suffix).toBe(404)
    }

    const activity = await request(app).get(`/api/threads/${thread.id}/activity`).set(auth)
    expect(activity.status).toBe(404)

    const deletion = await request(app).delete(`/api/threads/${thread.id}`).set(auth)
    expect(deletion.status).toBe(404)

    const bulk = await request(app)
      .patch('/api/threads/bulk')
      .set(auth)
      .send({ ids: [thread.id], status: 'resolu', deletedAt: true })
    expect(bulk.status).toBe(200)
    expect(bulk.body).toEqual({ updated: 0 })

    const untouched = await prisma.thread.findUnique({ where: { id: thread.id } })
    expect(untouched).toMatchObject({ status: 'nouveau', starred: false, deletedAt: null, archivedAt: null })
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
    expect(assignB.status).toBe(404)

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

  it('does not let org B update or delete org A personal resources', async () => {
    const draft = await prisma.mailDraft.create({
      data: { organizationId: orgA.organizationId, userId: orgA.userId, subject: 'Brouillon A', body: 'Secret' },
    })
    const mailbox = await prisma.externalMailboxConnection.create({
      data: {
        organizationId: orgA.organizationId,
        userId: orgA.userId,
        provider: 'imap',
        email: `private-${Date.now()}@a.example`,
        imapHost: 'imap.a.example',
        smtpHost: 'smtp.a.example',
        credentialEnc: 'encrypted-test-value',
      },
    })
    const proAddress = await prisma.threadRoutingRule.create({
      data: { organizationId: orgA.organizationId, canal: `private-${Date.now()}`, assignToId: orgA.userId },
    })
    const auth = { Authorization: `Bearer ${orgB.token}` }

    const draftList = await request(app).get('/api/drafts').set(auth)
    expect(draftList.body.find((item: { id: string }) => item.id === draft.id)).toBeUndefined()
    expect((await request(app).put(`/api/drafts/${draft.id}`).set(auth).send({ subject: 'Détourné' })).status).toBe(404)
    expect((await request(app).delete(`/api/drafts/${draft.id}`).set(auth)).status).toBe(404)

    expect((await request(app).delete(`/api/mailbox-connections/${mailbox.id}`).set(auth)).status).toBe(404)
    expect((await request(app).patch(`/api/mailbox-connections/${mailbox.id}/retry`).set(auth)).status).toBe(404)
    expect((await request(app).post(`/api/mailbox-connections/${mailbox.id}/import-history`).set(auth).send({ days: 1 })).status).toBe(404)

    expect((await request(app).post(`/api/pro-addresses/${proAddress.id}/claim`).set(auth)).status).toBe(404)

    expect(await prisma.mailDraft.findUnique({ where: { id: draft.id } })).not.toBeNull()
    expect(await prisma.externalMailboxConnection.findUnique({ where: { id: mailbox.id } })).not.toBeNull()
    expect((await prisma.threadRoutingRule.findUnique({ where: { id: proAddress.id } }))?.claimedAt).toBeNull()
  })

  it('does not let org B update org A users or revoke their grants and routing rules', async () => {
    const grant = await prisma.senderGrant.create({
      data: {
        organizationId: orgA.organizationId,
        userId: orgA.userId,
        email: `grant-${Date.now()}@org-a.example`,
      },
    })
    const rule = await prisma.threadRoutingRule.create({
      data: { organizationId: orgA.organizationId, canal: `restricted-${Date.now()}`, assignToId: orgA.userId },
    })
    const auth = { Authorization: `Bearer ${orgB.token}` }

    expect((await request(app).put(`/api/users/${orgA.userId}`).set(auth).send({ nom: 'Détourné' })).status).toBe(404)
    expect((await request(app).delete(`/api/users/${orgA.userId}/sender-grants/${grant.id}`).set(auth)).status).toBe(404)
    expect((await request(app).delete(`/api/users/${orgA.userId}`).set(auth)).status).toBe(404)
    expect((await request(app).delete(`/api/thread-routing-rules/${rule.canal}`).set(auth)).status).toBe(404)

    expect((await prisma.user.findUnique({ where: { id: orgA.userId } }))?.nom).toBe('Test User')
    expect(await prisma.senderGrant.findUnique({ where: { id: grant.id } })).not.toBeNull()
    expect(await prisma.threadRoutingRule.findUnique({ where: { id: rule.id } })).not.toBeNull()
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
