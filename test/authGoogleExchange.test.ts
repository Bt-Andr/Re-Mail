import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { issueLoginHandoff } from '../src/lib/loginHandoff'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

describe('POST /api/auth/google/exchange', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('google-exchange-test')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('exchanges a valid, unexpired handoff for a real session — same response shape as /signup', async () => {
    const handoff = await issueLoginHandoff(org.userId)
    const res = await request(app).post('/api/auth/google/exchange').send({ handoff })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.id).toBe(org.userId)
    expect(res.body.user.password).toBeUndefined()
    expect(res.body.organization.id).toBe(org.organizationId)
    expect(res.body.organization.memberCount).toBe(1)
  })

  it('rejects an unknown/tampered token', async () => {
    const res = await request(app).post('/api/auth/google/exchange').send({ handoff: 'not-a-real-token' })
    expect(res.status).toBe(401)
  })

  it('rejects a missing/empty body', async () => {
    const res = await request(app).post('/api/auth/google/exchange').send({})
    expect(res.status).toBe(400)
  })

  it('rejects the same token a second time (single use, even under concurrent exchange)', async () => {
    const handoff = await issueLoginHandoff(org.userId)

    const [first, second] = await Promise.all([
      request(app).post('/api/auth/google/exchange').send({ handoff }),
      request(app).post('/api/auth/google/exchange').send({ handoff }),
    ])
    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([200, 401])
  })

  it('rejects an expired handoff', async () => {
    const handoff = await issueLoginHandoff(org.userId)
    await prisma.loginHandoff.updateMany({ where: { userId: org.userId }, data: { expiresAt: new Date(Date.now() - 1000) } })

    const res = await request(app).post('/api/auth/google/exchange').send({ handoff })
    expect(res.status).toBe(401)
  })
})
