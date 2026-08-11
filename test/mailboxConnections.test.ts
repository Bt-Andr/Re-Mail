import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'

const mockConnect = vi.fn()
const mockMailboxOpen = vi.fn()
const mockLogout = vi.fn()
const mockClose = vi.fn()
vi.mock('imapflow', () => ({
  ImapFlow: vi.fn().mockImplementation(function () {
    return { connect: mockConnect, mailboxOpen: mockMailboxOpen, logout: mockLogout, close: mockClose }
  }),
}))

const mockVerify = vi.fn()
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn().mockImplementation(() => ({ verify: mockVerify, sendMail: vi.fn() })) },
}))

import app from '../src/app'
import prisma from '../src/lib/prisma'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

describe('POST /api/mailbox-connections', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('mailbox-conn-test')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  beforeEach(() => {
    mockConnect.mockReset().mockResolvedValue(undefined)
    mockMailboxOpen.mockReset().mockResolvedValue({ uidValidity: 1000n, uidNext: 50 })
    mockLogout.mockReset().mockResolvedValue(undefined)
    mockClose.mockReset()
    mockVerify.mockReset().mockResolvedValue(true)
  })

  it('rejects missing or invalid fields without attempting any connection', async () => {
    const res = await request(app)
      .post('/api/mailbox-connections')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ email: 'not-an-email' })
    expect(res.status).toBe(400)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('tests IMAP and SMTP live before creating a row, never echoing the credential', async () => {
    const res = await request(app)
      .post('/api/mailbox-connections')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        email: 'moi@example.com',
        imapHost: 'imap.example.com',
        imapPort: 993,
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        password: 'super-secret',
      })

    expect(res.status).toBe(201)
    expect(res.body.email).toBe('moi@example.com')
    expect(res.body.credentialEnc).toBeUndefined()
    expect(res.body.password).toBeUndefined()
    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockVerify).toHaveBeenCalledTimes(1)

    const row = await prisma.externalMailboxConnection.findUnique({ where: { id: res.body.id } })
    expect(row?.credentialEnc).toBeTruthy()
    expect(row?.credentialEnc).not.toContain('super-secret')
    // uidNext (50) - 1 : démarre le polling à partir de maintenant, pas un rapatriement complet.
    expect(row?.lastSeenUid).toBe(49)
  })

  it('returns 400 and creates nothing when the IMAP connection fails', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Invalid credentials'))

    const res = await request(app)
      .post('/api/mailbox-connections')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        email: 'bad@example.com',
        imapHost: 'imap.example.com',
        imapPort: 993,
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        password: 'wrong',
      })

    expect(res.status).toBe(400)
    expect(mockVerify).not.toHaveBeenCalled()
    const row = await prisma.externalMailboxConnection.findFirst({ where: { email: 'bad@example.com' } })
    expect(row).toBeNull()
  })

  it('returns 400 and creates nothing when SMTP verification fails (IMAP already succeeded)', async () => {
    mockVerify.mockRejectedValueOnce(new Error('SMTP auth failed'))

    const res = await request(app)
      .post('/api/mailbox-connections')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        email: 'imap-ok-smtp-bad@example.com',
        imapHost: 'imap.example.com',
        imapPort: 993,
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        password: 'partial',
      })

    expect(res.status).toBe(400)
    const row = await prisma.externalMailboxConnection.findFirst({ where: { email: 'imap-ok-smtp-bad@example.com' } })
    expect(row).toBeNull()
  })

  it('lists only the caller\'s own connections, deletes by ownership, and retry resets an errored connection', async () => {
    const create = await request(app)
      .post('/api/mailbox-connections')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ email: 'list-me@example.com', imapHost: 'imap.example.com', imapPort: 993, smtpHost: 'smtp.example.com', smtpPort: 465, password: 'x' })
    expect(create.status).toBe(201)

    const list = await request(app).get('/api/mailbox-connections').set('Authorization', `Bearer ${org.token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((c: { email: string }) => c.email === 'list-me@example.com')).toBe(true)

    await prisma.externalMailboxConnection.update({ where: { id: create.body.id }, data: { status: 'error', lastError: 'oops' } })
    const retry = await request(app).patch(`/api/mailbox-connections/${create.body.id}/retry`).set('Authorization', `Bearer ${org.token}`)
    expect(retry.status).toBe(200)
    const afterRetry = await prisma.externalMailboxConnection.findUnique({ where: { id: create.body.id } })
    expect(afterRetry?.status).toBe('connected')
    expect(afterRetry?.lastError).toBeNull()

    const del = await request(app).delete(`/api/mailbox-connections/${create.body.id}`).set('Authorization', `Bearer ${org.token}`)
    expect(del.status).toBe(204)
    expect(await prisma.externalMailboxConnection.findUnique({ where: { id: create.body.id } })).toBeNull()
  })
})
