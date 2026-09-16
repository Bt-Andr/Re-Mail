import bcrypt from 'bcryptjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { cleanupOrg, seedOrg, type SeededOrg } from './helpers/seed'

describe('user payload and password validation', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('user-validation')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('rejects a short password before creating a user', async () => {
    const email = `short-user-${Date.now()}@example.com`
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        username: `short-user-${Date.now()}`,
        nom: 'Short User',
        email,
        password: '1234567',
      })

    expect(response.status).toBe(400)
    expect(await prisma.user.findFirst({ where: { email } })).toBeNull()
  })

  it('creates a valid user and rejects a short replacement password without changing it', async () => {
    const username = `valid-user-${Date.now()}`
    const password = 'valid-password'
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        username,
        nom: 'Valid User',
        email: `${username}@example.com`,
        password,
        orgRole: 'MEMBER',
      })

    expect(created.status).toBe(200)

    const rejected = await request(app)
      .put(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ password: '1234567' })

    expect(rejected.status).toBe(400)
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: created.body.id } })
    expect(await bcrypt.compare(password, stored.password)).toBe(true)
  })
})
