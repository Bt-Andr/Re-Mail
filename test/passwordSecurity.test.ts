import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import crypto from 'crypto'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { cleanupOrg, seedOrg, type SeededOrg } from './helpers/seed'

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

describe('Password and session security', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('password-security')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('changes the password, returns a fresh session, and revokes the previous token', async () => {
    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'new-password-123' })
    expect(wrong.status).toBe(400)

    const changed = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ currentPassword: 'password123', newPassword: 'new-password-123' })
    expect(changed.status).toBe(200)
    expect(changed.body.token).toEqual(expect.any(String))

    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${org.token}`)).status).toBe(403)
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${changed.body.token}`)).status).toBe(200)

    expect((await request(app).post('/api/auth/login').send({ username: org.username, password: 'password123' })).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ username: org.username, password: 'new-password-123' })).status).toBe(200)
  })

  it('returns the same reset-request response for existing and unknown accounts', async () => {
    const existing = await request(app).post('/api/auth/password-reset/request').send({ username: org.username })
    const unknown = await request(app).post('/api/auth/password-reset/request').send({ username: `unknown-${Date.now()}` })

    expect(existing.status).toBe(202)
    expect(unknown.status).toBe(202)
    expect(existing.body).toEqual(unknown.body)
  })

  it('consumes a reset token once and revokes sessions issued before the reset', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: org.username, password: 'new-password-123' })
    expect(login.status).toBe(200)

    const rawToken = crypto.randomBytes(32).toString('base64url')
    await prisma.passwordResetToken.create({
      data: { userId: org.userId, tokenHash: tokenHash(rawToken), expiresAt: new Date(Date.now() + 60_000) },
    })

    const reset = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: rawToken, newPassword: 'reset-password-123' })
    expect(reset.status).toBe(200)

    const replay = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: rawToken, newPassword: 'another-password-123' })
    expect(replay.status).toBe(400)

    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`)).status).toBe(403)
    expect((await request(app).post('/api/auth/login').send({ username: org.username, password: 'reset-password-123' })).status).toBe(200)
    expect((await request(app).post('/api/auth/login').send({ username: org.username, password: 'another-password-123' })).status).toBe(401)
  })

  it('rejects expired reset tokens without changing the password', async () => {
    const rawToken = crypto.randomBytes(32).toString('base64url')
    await prisma.passwordResetToken.create({
      data: { userId: org.userId, tokenHash: tokenHash(rawToken), expiresAt: new Date(Date.now() - 1_000) },
    })

    const response = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: rawToken, newPassword: 'expired-password-123' })
    expect(response.status).toBe(400)
    expect((await request(app).post('/api/auth/login').send({ username: org.username, password: 'reset-password-123' })).status).toBe(200)
  })

  it('allows only one concurrent consumption of the same reset token', async () => {
    const fresh = await seedOrg('password-reset-race')
    const rawToken = crypto.randomBytes(32).toString('base64url')
    await prisma.passwordResetToken.create({
      data: { userId: fresh.userId, tokenHash: tokenHash(rawToken), expiresAt: new Date(Date.now() + 60_000) },
    })

    const responses = await Promise.all([
      request(app).post('/api/auth/password-reset/confirm').send({ token: rawToken, newPassword: 'race-password-a' }),
      request(app).post('/api/auth/password-reset/confirm').send({ token: rawToken, newPassword: 'race-password-b' }),
    ])
    expect(responses.map(response => response.status).sort()).toEqual([200, 400])

    const successfulPasswords = await Promise.all([
      request(app).post('/api/auth/login').send({ username: fresh.username, password: 'race-password-a' }),
      request(app).post('/api/auth/login').send({ username: fresh.username, password: 'race-password-b' }),
    ])
    expect(successfulPasswords.filter(response => response.status === 200)).toHaveLength(1)

    await cleanupOrg(fresh.organizationId)
  })
})
