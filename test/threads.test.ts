import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import type { Prisma } from '@prisma/client'
import app from '../src/app'
import prisma from '../src/lib/prisma'
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

describe('GET /api/threads — recherche, pagination, non-lu', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('threads-search')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('trouve un fil par sujet, expéditeur, ou corps de message (insensible à la casse)', async () => {
    const bySujet = await createThread(org, { sujet: 'Facture impayée numéro 42' })
    const byFrom = await createThread(org, { externalFrom: 'Jocelyne Endon', sujet: 'Autre sujet' })
    const byBody = await createThread(org, { sujet: 'Rien à voir' })
    await prisma.threadMessage.create({
      data: {
        organizationId: org.organizationId,
        threadId: byBody.id,
        direction: 'inbound',
        fromName: 'X',
        fromEmail: 'x@example.com',
        body: 'Voici le virement bancaire demandé',
      },
    })

    const r1 = await request(app).get('/api/threads?folder=inbox&q=facture').set('Authorization', `Bearer ${org.token}`)
    expect(r1.body.map((t: { id: string }) => t.id)).toContain(bySujet.id)

    const r2 = await request(app).get('/api/threads?folder=inbox&q=JOCELYNE').set('Authorization', `Bearer ${org.token}`)
    expect(r2.body.map((t: { id: string }) => t.id)).toContain(byFrom.id)

    const r3 = await request(app).get('/api/threads?folder=inbox&q=virement').set('Authorization', `Bearer ${org.token}`)
    expect(r3.body.map((t: { id: string }) => t.id)).toContain(byBody.id)

    const r4 = await request(app).get('/api/threads?folder=inbox&q=inexistant-xyz').set('Authorization', `Bearer ${org.token}`)
    expect(r4.body.map((t: { id: string }) => t.id)).not.toContain(bySujet.id)
  })

  it('pagine avec take/skip, et renvoie tout sans eux (rétrocompatible)', async () => {
    const fresh = await seedOrg('threads-paging')
    const threads = []
    for (let i = 0; i < 5; i++) {
      threads.push(await createThread(fresh, { sujet: `Fil ${i}` }))
    }

    const all = await request(app).get('/api/threads?folder=inbox').set('Authorization', `Bearer ${fresh.token}`)
    expect(all.body.length).toBe(5)

    const page1 = await request(app).get('/api/threads?folder=inbox&take=2&skip=0').set('Authorization', `Bearer ${fresh.token}`)
    expect(page1.body.length).toBe(2)

    const page2 = await request(app).get('/api/threads?folder=inbox&take=2&skip=2').set('Authorization', `Bearer ${fresh.token}`)
    expect(page2.body.length).toBe(2)
    expect(page2.body.map((t: { id: string }) => t.id)).not.toEqual(page1.body.map((t: { id: string }) => t.id))

    await cleanupOrg(fresh.organizationId)
  })

  it('marque un fil comme non lu, et respecte le contrôle d\'accès', async () => {
    const thread = await createThread(org)
    await prisma.threadMessage.create({
      data: {
        organizationId: org.organizationId,
        threadId: thread.id,
        direction: 'inbound',
        fromName: 'Client',
        fromEmail: 'client@example.com',
        body: 'Message initial',
      },
    })

    // Ouvrir le fil le marque lu (effet de bord existant de GET /:id)
    const opened = await request(app).get(`/api/threads/${thread.id}`).set('Authorization', `Bearer ${org.token}`)
    expect(opened.status).toBe(200)
    const afterOpen = await request(app).get('/api/threads?folder=inbox').set('Authorization', `Bearer ${org.token}`)
    expect(afterOpen.body.find((t: { id: string }) => t.id === thread.id).unreadCount).toBe(0)

    const unread = await request(app).patch(`/api/threads/${thread.id}/unread`).set('Authorization', `Bearer ${org.token}`)
    expect(unread.status).toBe(200)
    const afterUnread = await request(app).get('/api/threads?folder=inbox').set('Authorization', `Bearer ${org.token}`)
    expect(afterUnread.body.find((t: { id: string }) => t.id === thread.id).unreadCount).toBe(1)

    // Un MEMBER non assigné à ce fil ne peut pas le manipuler
    const otherOrg = await seedOrg('threads-unread-member')
    const forbidden = await request(app).patch(`/api/threads/${thread.id}/unread`).set('Authorization', `Bearer ${otherOrg.token}`)
    expect(forbidden.status).toBe(404) // autre org : introuvable, pas 403 (isolation tenant)
    await cleanupOrg(otherOrg.organizationId)
  })
})
