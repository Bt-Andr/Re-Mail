import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

describe('POST /api/auth/signup', () => {
  const createdOrgIds: string[] = []

  afterAll(async () => {
    for (const id of createdOrgIds) await cleanupOrg(id)
  })

  it('creates an organization and its first OWNER user', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        orgName: `Signup Test ${Date.now()}`,
        username: `owner-${Date.now()}`,
        email: `owner-${Date.now()}@example.com`,
        password: 'a-strong-password',
        nom: 'Owner Test',
      })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.orgRole).toBe('OWNER')
    expect(res.body.user.password).toBeUndefined()
    expect(res.body.organization.id).toBeTruthy()
    createdOrgIds.push(res.body.organization.id)
  })

  it('rejects missing required fields', async () => {
    const res = await request(app).post('/api/auth/signup').send({ orgName: 'Champs manquants' })
    expect(res.status).toBe(400)
  })

  it('creates an invisible personal organization when accountType is perso, without requiring orgName', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        accountType: 'perso',
        username: `perso-${Date.now()}`,
        email: `perso-${Date.now()}@example.com`,
        password: 'a-strong-password',
        nom: 'Perso Test',
      })
    expect(res.status).toBe(201)
    expect(res.body.user.orgRole).toBe('OWNER')
    createdOrgIds.push(res.body.organization.id)

    const org = await prisma.organization.findUnique({ where: { id: res.body.organization.id } })
    expect(org?.isPersonal).toBe(true)
  })

  it('creates a pro organization (isPersonal false) on a regular signup', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        orgName: `Pro Org ${Date.now()}`,
        username: `pro-${Date.now()}`,
        email: `pro-${Date.now()}@example.com`,
        password: 'a-strong-password',
        nom: 'Pro Test',
      })
    expect(res.status).toBe(201)
    createdOrgIds.push(res.body.organization.id)

    const org = await prisma.organization.findUnique({ where: { id: res.body.organization.id } })
    expect(org?.isPersonal).toBe(false)
  })

  it('rejects a perso signup missing required fields other than orgName', async () => {
    const res = await request(app).post('/api/auth/signup').send({ accountType: 'perso', nom: 'Sans rien' })
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate username/email', async () => {
    const username = `dupe-${Date.now()}`
    const email = `dupe-${Date.now()}@example.com`

    const first = await request(app)
      .post('/api/auth/signup')
      .send({ orgName: `Dup Org ${Date.now()}`, username, email, password: 'a-strong-password', nom: 'Première' })
    expect(first.status).toBe(201)
    createdOrgIds.push(first.body.organization.id)

    const second = await request(app)
      .post('/api/auth/signup')
      .send({ orgName: `Dup Org 2 ${Date.now()}`, username, email, password: 'another-password', nom: 'Seconde' })
    expect(second.status).toBe(409)
  })
})

describe('POST /api/auth/login', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('login-test')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('logs in with correct credentials and never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: org.username, password: 'password123' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.id).toBe(org.userId)
    expect(res.body.user.password).toBeUndefined()
  })

  it('rejects a wrong password with a generic message', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: org.username, password: 'wrong-password' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Identifiants incorrects.')
  })

  it('rejects an unknown username with the same generic message (no user enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'does-not-exist-anywhere', password: 'whatever' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Identifiants incorrects.')
  })

  it('rejects missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: org.username })
    expect(res.status).toBe(400)
  })

  it('rate-limits repeated login attempts from the same client', async () => {
    let limited = false
    for (let i = 0; i < 25; i++) {
      const res = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'whatever' })
      if (res.status === 429) {
        limited = true
        break
      }
      expect(res.status).toBe(401)
    }
    expect(limited).toBe(true)
  }, 20000)
})
