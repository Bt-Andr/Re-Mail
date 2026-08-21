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
