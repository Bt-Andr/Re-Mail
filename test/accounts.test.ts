import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { encryptMailboxCredential } from '../src/lib/mailboxCredentialCrypto'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

describe('GET /api/accounts', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('accounts-test')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('returns an empty list when the user has no sender-backed address and no connected mailbox', async () => {
    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${org.token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('adds the "resend" pseudo-account only once a Resend-backed sender exists (proEmail), never for a bare org', async () => {
    await prisma.user.update({ where: { id: org.userId }, data: { proEmail: 'moi@pro.example.com' } })
    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${org.token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ id: 'resend', kind: 'resend', provider: 'resend', email: 'moi@pro.example.com', status: null })
    await prisma.user.update({ where: { id: org.userId }, data: { proEmail: null } })
  })

  it('lists connected mailboxes in createdAt order and never exposes credentialEnc', async () => {
    const first = await prisma.externalMailboxConnection.create({
      data: {
        organizationId: org.organizationId,
        userId: org.userId,
        provider: 'imap',
        email: 'premiere@example.com',
        imapHost: 'imap.example.com',
        smtpHost: 'smtp.example.com',
        credentialEnc: encryptMailboxCredential('password'),
      },
    })
    const second = await prisma.externalMailboxConnection.create({
      data: {
        organizationId: org.organizationId,
        userId: org.userId,
        provider: 'gmail',
        email: 'deuxieme@example.com',
        imapHost: 'imap.gmail.com',
        smtpHost: 'smtp.gmail.com',
        credentialEnc: encryptMailboxCredential('refresh-token'),
        status: 'error',
        lastError: 'expiré',
      },
    })

    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${org.token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { id: first.id, kind: 'mailbox', provider: 'imap', email: 'premiere@example.com', label: 'premiere@example.com', status: 'connected' },
      { id: second.id, kind: 'mailbox', provider: 'gmail', email: 'deuxieme@example.com', label: 'deuxieme@example.com', status: 'error' },
    ])
    expect(JSON.stringify(res.body)).not.toContain('credentialEnc')
    expect(JSON.stringify(res.body)).not.toContain('refresh-token')

    await prisma.externalMailboxConnection.deleteMany({ where: { organizationId: org.organizationId } })
  })

  it('requires authentication', async () => {
    const res = await request(app).get('/api/accounts')
    expect(res.status).toBe(401)
  })
})
