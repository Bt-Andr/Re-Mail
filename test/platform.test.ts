import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

describe('Platform administration', () => {
  let org: SeededOrg
  let adminId: string
  let token: string

  beforeAll(async () => {
    org = await seedOrg('platform-api-test')
    const admin = await prisma.platformAdmin.create({
      data: { email: 'platform-test@example.com', name: 'Platform Test', passwordHash: await bcrypt.hash('correct-password', 4) },
    })
    adminId = admin.id
    const login = await request(app).post('/api/platform/auth/login').send({ email: admin.email, password: 'correct-password' })
    expect(login.status).toBe(200)
    token = login.body.token
  })

  afterAll(async () => {
    await prisma.platformAdmin.deleteMany({ where: { id: adminId } })
    await cleanupOrg(org.organizationId)
  })

  it('rejects invalid credentials without revealing the account state', async () => {
    const response = await request(app).post('/api/platform/auth/login').send({ email: 'platform-test@example.com', password: 'wrong' })
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Identifiants incorrects.')
  })

  it('rejects an organization user token on platform endpoints', async () => {
    const response = await request(app).get('/api/platform/organizations').set('Authorization', `Bearer ${org.token}`)
    expect(response.status).toBe(403)
  })

  it('returns read-only cross-tenant organization metrics', async () => {
    const response = await request(app).get('/api/platform/organizations').set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    const item = response.body.items.find((candidate: { id: string }) => candidate.id === org.organizationId)
    expect(item).toMatchObject({ id: org.organizationId, _count: { users: 1 } })
    expect(item.resendApiKeyEnc).toBeUndefined()
    expect(item.webhookSecretEnc).toBeUndefined()
  })

  it('returns global metrics and an organization detail without secrets', async () => {
    const headers = { Authorization: `Bearer ${token}` }
    const summary = await request(app).get('/api/platform/summary').set(headers)
    expect(summary.status).toBe(200)
    expect(summary.body.organizations).toBeGreaterThan(0)
    const detail = await request(app).get(`/api/platform/organizations/${org.organizationId}`).set(headers)
    expect(detail.status).toBe(200)
    expect(detail.body.id).toBe(org.organizationId)
    expect(detail.body.resendApiKeyEnc).toBeUndefined()
  })

  it('returns users without password hashes', async () => {
    const response = await request(app).get('/api/platform/users').set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    const item = response.body.find((candidate: { id: string }) => candidate.id === org.userId)
    expect(item.organization.id).toBe(org.organizationId)
    expect(item.password).toBeUndefined()
  })
})
