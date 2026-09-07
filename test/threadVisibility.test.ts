import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import type { Prisma } from '@prisma/client'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import config from '../src/config'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

async function createThread(org: SeededOrg, overrides: Partial<Prisma.ThreadUncheckedCreateInput> = {}) {
  return prisma.thread.create({
    data: {
      organizationId: org.organizationId,
      canal: 'contact',
      sujet: 'Sujet par défaut',
      externalFrom: 'Client Test',
      externalEmail: `client-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      origin: 'inbound',
      ...overrides,
    },
  })
}

// Même règle pour tout le monde, y compris OWNER/ADMIN : un thread issu d'une adresse
// pro (ThreadRoutingRule active) reste invisible tant que la personne assignée ne l'a
// pas "connectée" (claimedAt) — la vue d'ensemble manager ne contourne plus ça (décision
// produit actée, voir plan de refonte identité).
describe('Visibilité des threads issus d\'une adresse pro — claim requis, y compris pour un manager', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('thread-vis')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('un OWNER ne voit pas un thread routé vers lui via une adresse pro tant qu\'il ne l\'a pas connectée', async () => {
    await prisma.threadRoutingRule.create({
      data: { organizationId: org.organizationId, canal: 'ventes', assignToId: org.userId, active: true },
    })
    const thread = await createThread(org, { canal: 'ventes', sujet: 'Devis urgent' })

    const list = await request(app).get('/api/threads?folder=inbox').set('Authorization', `Bearer ${org.token}`)
    expect(list.body.map((t: { id: string }) => t.id)).not.toContain(thread.id)

    const detail = await request(app).get(`/api/threads/${thread.id}`).set('Authorization', `Bearer ${org.token}`)
    expect(detail.status).toBe(403)
  })

  it('devient visible une fois l\'adresse pro connectée (claim)', async () => {
    const rule = await prisma.threadRoutingRule.findFirstOrThrow({ where: { organizationId: org.organizationId, canal: 'ventes' } })
    const claim = await request(app).post(`/api/pro-addresses/${rule.id}/claim`).set('Authorization', `Bearer ${org.token}`)
    expect(claim.status).toBe(200)

    const thread = await prisma.thread.findFirstOrThrow({ where: { organizationId: org.organizationId, canal: 'ventes' } })
    const list = await request(app).get('/api/threads?folder=inbox').set('Authorization', `Bearer ${org.token}`)
    expect(list.body.map((t: { id: string }) => t.id)).toContain(thread.id)

    const detail = await request(app).get(`/api/threads/${thread.id}`).set('Authorization', `Bearer ${org.token}`)
    expect(detail.status).toBe(200)
  })

  it('un thread sans ThreadRoutingRule (canal générique) reste visible à un manager comme avant', async () => {
    const thread = await createThread(org, { canal: 'generique-sans-regle' })
    const list = await request(app).get('/api/threads?folder=inbox').set('Authorization', `Bearer ${org.token}`)
    expect(list.body.map((t: { id: string }) => t.id)).toContain(thread.id)
  })

  it('le canal réservé "email" (boîtes IMAP/Gmail personnelles) n\'est jamais masqué, même si une ThreadRoutingRule y existe par erreur', async () => {
    // PUT /thread-routing-rules/email est refusé désormais (voir proAddresses.test.ts),
    // mais une ligne préexistante (créée avant ce correctif) doit rester inoffensive —
    // insérée directement pour simuler cette donnée résiduelle.
    const other = await prisma.user.create({
      data: { organizationId: org.organizationId, username: `other-${Date.now()}`, email: `other-${Date.now()}@thread-vis.example`, password: 'x', nom: 'Other', orgRole: 'MEMBER' },
    })
    await prisma.threadRoutingRule.create({
      data: { organizationId: org.organizationId, canal: 'email', assignToId: other.id, active: true },
    })
    const mailboxThread = await createThread(org, { canal: 'email', assignedToId: org.userId })

    const list = await request(app).get('/api/threads?folder=inbox').set('Authorization', `Bearer ${org.token}`)
    expect(list.body.map((t: { id: string }) => t.id)).toContain(mailboxThread.id)

    const detail = await request(app).get(`/api/threads/${mailboxThread.id}`).set('Authorization', `Bearer ${org.token}`)
    expect(detail.status).toBe(200)
  })

  it('un MEMBER assigné via une adresse pro non connectée ne la voit pas non plus (même si assignedToId le désigne)', async () => {
    const member = await prisma.user.create({
      data: { organizationId: org.organizationId, username: `member-vis-${Date.now()}`, email: `member-vis-${Date.now()}@thread-vis.example`, password: 'x', nom: 'Member', orgRole: 'MEMBER' },
    })
    const memberToken = jwt.sign(
      { id: member.id, organizationId: org.organizationId, username: member.username, orgRole: member.orgRole, nom: member.nom },
      config.jwtSecret,
      { expiresIn: '1h' }
    )

    await prisma.threadRoutingRule.create({
      data: { organizationId: org.organizationId, canal: 'support-member', assignToId: member.id, active: true },
    })
    const thread = await createThread(org, { canal: 'support-member', assignedToId: member.id })

    const list = await request(app).get('/api/threads?folder=inbox').set('Authorization', `Bearer ${memberToken}`)
    expect(list.body.map((t: { id: string }) => t.id)).not.toContain(thread.id)
  })

  it('filtrer explicitement par un canal caché (?canal=) renvoie une liste vide plutôt que de fuiter le fil', async () => {
    const list = await request(app).get('/api/threads?folder=inbox&canal=ventes-non-reclame').set('Authorization', `Bearer ${org.token}`)
    // Aucune règle pour ce canal précis dans ce test -> pas caché -> comportement normal (liste vide, canal inexistant)
    expect(list.status).toBe(200)
    expect(list.body).toEqual([])

    await prisma.threadRoutingRule.create({
      data: { organizationId: org.organizationId, canal: 'ventes-cachee', assignToId: org.userId, active: true },
    })
    await createThread(org, { canal: 'ventes-cachee' })
    const hidden = await request(app).get('/api/threads?folder=inbox&canal=ventes-cachee').set('Authorization', `Bearer ${org.token}`)
    expect(hidden.status).toBe(200)
    expect(hidden.body).toEqual([])
  })
})

describe('Isolation des fils de boîtes externes personnelles', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('personal-thread-vis')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('refuse liste, détail, activité et mutations à un autre manager de la même organisation', async () => {
    const mailboxOwner = await prisma.user.create({
      data: {
        organizationId: org.organizationId,
        username: `mailbox-owner-${Date.now()}`,
        email: `mailbox-owner-${Date.now()}@example.com`,
        password: 'x',
        nom: 'Mailbox Owner',
        orgRole: 'ADMIN',
      },
    })
    const ownerToken = jwt.sign(
      { id: mailboxOwner.id, organizationId: org.organizationId, username: mailboxOwner.username, orgRole: mailboxOwner.orgRole, nom: mailboxOwner.nom },
      config.jwtSecret,
      { expiresIn: '1h' }
    )
    const connection = await prisma.externalMailboxConnection.create({
      data: {
        organizationId: org.organizationId,
        userId: mailboxOwner.id,
        provider: 'imap',
        email: mailboxOwner.email,
        imapHost: 'imap.example.com',
        smtpHost: 'smtp.example.com',
        credentialEnc: 'irrelevant',
      },
    })
    const thread = await createThread(org, {
      canal: 'email',
      assignedToId: mailboxOwner.id,
      sourceId: connection.id,
      sourceType: connection.provider,
    })

    const foreignList = await request(app).get('/api/threads?folder=inbox').set('Authorization', `Bearer ${org.token}`)
    expect(foreignList.body.map((item: { id: string }) => item.id)).not.toContain(thread.id)

    const foreignAccount = await request(app)
      .get(`/api/threads?folder=inbox&account=${connection.id}`)
      .set('Authorization', `Bearer ${org.token}`)
    expect(foreignAccount.status).toBe(200)
    expect(foreignAccount.body).toEqual([])

    const foreignDetail = await request(app).get(`/api/threads/${thread.id}`).set('Authorization', `Bearer ${org.token}`)
    expect(foreignDetail.status).toBe(403)

    const foreignActivity = await request(app).get(`/api/threads/${thread.id}/activity`).set('Authorization', `Bearer ${org.token}`)
    expect(foreignActivity.status).toBe(403)

    const foreignStatus = await request(app)
      .patch(`/api/threads/${thread.id}/status`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ status: 'en_cours' })
    expect(foreignStatus.status).toBe(403)

    const foreignAssign = await request(app)
      .patch(`/api/threads/${thread.id}/assign`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ assignedToId: org.userId })
    expect(foreignAssign.status).toBe(403)

    const foreignBulk = await request(app)
      .patch('/api/threads/bulk')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ ids: [thread.id], status: 'resolu' })
    expect(foreignBulk.status).toBe(200)
    expect(foreignBulk.body.updated).toBe(0)

    const ownList = await request(app).get('/api/threads?folder=inbox').set('Authorization', `Bearer ${ownerToken}`)
    expect(ownList.body.map((item: { id: string }) => item.id)).toContain(thread.id)

    const ownDetail = await request(app).get(`/api/threads/${thread.id}`).set('Authorization', `Bearer ${ownerToken}`)
    expect(ownDetail.status).toBe(200)
  })
})
