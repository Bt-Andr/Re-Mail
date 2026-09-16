import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { cleanupOrg, seedOrg, type SeededOrg } from './helpers/seed'

describe('User and device HTTP semantics', () => {
  let orgA: SeededOrg
  let orgB: SeededOrg

  beforeAll(async () => {
    orgA = await seedOrg('users-devices-a')
    orgB = await seedOrg('users-devices-b')
  })

  afterAll(async () => {
    await cleanupOrg(orgA.organizationId)
    await cleanupOrg(orgB.organizationId)
  })

  it('returns 409 for a duplicate username', async () => {
    const payload = {
      username: `duplicate-${Date.now()}`,
      nom: 'Premier compte',
      email: `first-${Date.now()}@example.com`,
      password: 'password-123',
    }
    const first = await request(app).post('/api/users').set('Authorization', `Bearer ${orgA.token}`).send(payload)
    expect(first.status).toBe(201)

    const duplicate = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ ...payload, email: `second-${Date.now()}@example.com` })
    expect(duplicate.status).toBe(409)
  })

  it('rejects an unknown sender alias before creating a user', async () => {
    const username = `invalid-grant-${Date.now()}`
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({
        username,
        nom: 'Alias invalide',
        email: `${username}@example.com`,
        password: 'password-123',
        grantedSenders: ['missing@mail.example.com'],
      })

    expect(response.status).toBe(400)
    expect(await prisma.user.findUnique({ where: { username } })).toBeNull()
  })

  it('distinguishes a missing user from an identity collision on update', async () => {
    const missing = await request(app)
      .put('/api/users/missing')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ nom: 'Personne' })
    expect(missing.status).toBe(404)

    const username = `update-collision-${Date.now()}`
    const first = await prisma.user.create({
      data: {
        organizationId: orgA.organizationId,
        username,
        email: `${username}@example.com`,
        password: 'irrelevant',
        nom: 'Premier',
      },
    })
    const second = await prisma.user.create({
      data: {
        organizationId: orgA.organizationId,
        username: `${username}-second`,
        email: `${username}-second@example.com`,
        password: 'irrelevant',
        nom: 'Second',
      },
    })

    const collision = await request(app)
      .put(`/api/users/${second.id}`)
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ username: first.username })
    expect(collision.status).toBe(409)
  })

  it('returns 409 when database relations still prevent user deletion', async () => {
    const username = `referenced-${Date.now()}`
    const user = await prisma.user.create({
      data: {
        organizationId: orgA.organizationId,
        username,
        email: `${username}@example.com`,
        password: 'irrelevant',
        nom: 'Utilisateur référencé',
      },
    })
    await prisma.threadRoutingRule.create({
      data: {
        organizationId: orgA.organizationId,
        canal: 'support',
        assignToId: user.id,
      },
    })

    const response = await request(app)
      .delete(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${orgA.token}`)
    expect(response.status).toBe(409)
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull()
  })

  it('rejects malformed device registrations before persistence', async () => {
    const response = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ expoPushToken: 'push-token-invalid-platform', platform: { os: 'ios' } })

    expect(response.status).toBe(400)
    expect(await prisma.deviceToken.findUnique({ where: { expoPushToken: 'push-token-invalid-platform' } })).toBeNull()
  })

  it('moves a globally unique device token to the current session and protects deletion ownership', async () => {
    const expoPushToken = `ExponentPushToken[test-${Date.now()}]`
    const first = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${orgA.token}`)
      .send({ expoPushToken, platform: 'ios' })
    expect(first.status).toBe(201)

    const moved = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${orgB.token}`)
      .send({ expoPushToken, platform: 'android' })
    expect(moved.status).toBe(201)

    const stored = await prisma.deviceToken.findUniqueOrThrow({ where: { expoPushToken } })
    expect(stored).toMatchObject({ organizationId: orgB.organizationId, userId: orgB.userId, platform: 'android' })
    expect(await prisma.deviceToken.count({ where: { expoPushToken } })).toBe(1)

    const formerOwnerDelete = await request(app)
      .delete(`/api/devices/${encodeURIComponent(expoPushToken)}`)
      .set('Authorization', `Bearer ${orgA.token}`)
    expect(formerOwnerDelete.status).toBe(404)

    const currentOwnerDelete = await request(app)
      .delete(`/api/devices/${encodeURIComponent(expoPushToken)}`)
      .set('Authorization', `Bearer ${orgB.token}`)
    expect(currentOwnerDelete.status).toBe(200)
  })
})
