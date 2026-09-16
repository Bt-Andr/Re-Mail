import { afterEach, describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'
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
import config from '../src/config'

describe('PATCH /api/threads — erreurs internes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('réserve 500 à une panne inattendue au lieu de la maquiller en 404', async () => {
    const token = jwt.sign(
      { id: 'user-test', organizationId: 'org-test', username: 'test', orgRole: 'OWNER', nom: 'Test' },
      config.jwtSecret,
      { expiresIn: '1h' }
    )
    scopedDb.thread.findUnique
      .mockResolvedValueOnce({ assignedToId: null, canal: 'contact', sourceId: null })
      .mockResolvedValueOnce({ status: 'nouveau' })
    scopedDb.threadRoutingRule.findMany.mockResolvedValue([])
    scopedDb.thread.update.mockRejectedValue(new Error('database unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await request(app)
      .patch('/api/threads/thread-test/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'en_cours' })

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Erreur serveur.' })
    expect(response.body.error).not.toContain('database unavailable')
  })
})
