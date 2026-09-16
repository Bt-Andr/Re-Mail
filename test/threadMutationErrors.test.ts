import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const scopedDb = vi.hoisted(() => ({
  thread: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  threadRoutingRule: {
    findMany: vi.fn(),
  },
}))

vi.mock('../src/middleware/scopedPrisma', () => ({
  forOrg: () => scopedDb,
}))

import app from '../src/app'
import { cleanupOrg, seedOrg, type SeededOrg } from './helpers/seed'

describe('PATCH /api/threads — erreurs internes', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('thread-mutation-errors')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('réserve 500 à une panne inattendue au lieu de la maquiller en 404', async () => {
    scopedDb.thread.findUnique
      .mockResolvedValueOnce({ assignedToId: null, canal: 'contact', sourceId: null })
      .mockResolvedValueOnce({ status: 'nouveau' })
    scopedDb.threadRoutingRule.findMany.mockResolvedValue([])
    scopedDb.thread.update.mockRejectedValue(new Error('database unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await request(app)
      .patch('/api/threads/thread-test/status')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ status: 'en_cours' })

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Erreur serveur.' })
    expect(response.body.error).not.toContain('database unavailable')
  })
})
