import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
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

describe('POST /api/mailbox-connections/imap/signin', () => {
  const signinBody = {
    email: 'moi@imap-signin-test.example',
    imapHost: 'imap.example.com',
    imapPort: 993,
    smtpHost: 'smtp.example.com',
    smtpPort: 465,
    password: 'super-secret',
  }

  beforeEach(() => {
    mockConnect.mockReset().mockResolvedValue(undefined)
    mockMailboxOpen.mockReset().mockResolvedValue({ uidValidity: 1000n, uidNext: 50 })
    mockLogout.mockReset().mockResolvedValue(undefined)
    mockClose.mockReset()
    mockVerify.mockReset().mockResolvedValue(true)
  })

  async function cleanupSigninAccount(email: string) {
    // email n'est plus unique globalement (schema.prisma) — ne nettoie que le(s)
    // compte(s) PERSO auto-créés par le signin ; les comptes pro sont créés et
    // nettoyés explicitement par les tests qui les posent.
    const leftovers = await prisma.user.findMany({ where: { email, organization: { isPersonal: true } } })
    for (const leftover of leftovers) await cleanupOrg(leftover.organizationId)
  }

  afterEach(() => cleanupSigninAccount(signinBody.email))

  it('rejects missing or invalid fields without attempting any connection', async () => {
    const res = await request(app).post('/api/mailbox-connections/imap/signin').send({ email: 'not-an-email' })
    expect(res.status).toBe(400)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('returns 400 without creating an account when the IMAP connection fails', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Invalid credentials'))
    const res = await request(app).post('/api/mailbox-connections/imap/signin').send(signinBody)
    expect(res.status).toBe(400)
    expect(await prisma.user.findFirst({ where: { email: signinBody.email } })).toBeNull()
  })

  it('creates a new personal account, connects the mailbox, and issues a real session', async () => {
    const res = await request(app).post('/api/mailbox-connections/imap/signin').send(signinBody)
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.email).toBe(signinBody.email)
    expect(res.body.organization.isPersonal).toBe(true)

    const user = await prisma.user.findFirst({ where: { email: signinBody.email }, include: { organization: true } })
    expect(user).toBeTruthy()
    expect(user?.orgRole).toBe('OWNER')
    expect(user?.organization.isPersonal).toBe(true)

    const connection = await prisma.externalMailboxConnection.findFirst({ where: { organizationId: user!.organizationId, email: signinBody.email } })
    expect(connection?.provider).toBe('imap')
    expect(connection?.userId).toBe(user!.id)

    // Un jeton issu de ce endpoint doit fonctionner comme n'importe quelle session.
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)
    expect(me.status).toBe(200)
  })

  it('signs an existing personal-account user back in without creating a duplicate account', async () => {
    const organization = await prisma.organization.create({
      data: { name: 'Moi (perso imap)', slug: `moi-perso-imap-${Date.now()}`, isPersonal: true },
    })
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        username: `moi-imap-${Date.now()}`,
        email: signinBody.email,
        password: 'unused-random-hash',
        nom: 'Moi',
        orgRole: 'OWNER',
      },
    })

    const res = await request(app).post('/api/mailbox-connections/imap/signin').send(signinBody)
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()

    const usersWithEmail = await prisma.user.findMany({ where: { email: signinBody.email } })
    expect(usersWithEmail).toHaveLength(1)
    expect(usersWithEmail[0].id).toBe(user.id)

    const connection = await prisma.externalMailboxConnection.findFirst({ where: { organizationId: organization.id, email: signinBody.email } })
    expect(connection?.userId).toBe(user.id)
  })

  it('never resolves to an existing pro (team) account — creates a separate personal account instead, even with the same email', async () => {
    const proOrg = await prisma.organization.create({
      data: { name: 'Pro Co Imap', slug: `pro-co-imap-${Date.now()}`, isPersonal: false },
    })
    const proUser = await prisma.user.create({
      data: {
        organizationId: proOrg.id,
        username: `pro-owner-imap-${Date.now()}`,
        email: signinBody.email,
        password: 'unused-random-hash',
        nom: 'Pro Owner',
        orgRole: 'OWNER',
      },
    })

    const res = await request(app).post('/api/mailbox-connections/imap/signin').send(signinBody)
    // Une session est délivrée, mais JAMAIS pour le compte pro — l'authentification
    // IMAP ne doit jamais donner accès à une organisation automatiquement (décision
    // produit actée — voir plan de refonte "Découpler l'identité personnelle de
    // l'accès organisation").
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.id).not.toBe(proUser.id)
    expect(res.body.organization.isPersonal).toBe(true)

    // Le compte pro n'est jamais touché : ni mailbox attachée, ni trace de cette
    // connexion IMAP dessus.
    const proConnection = await prisma.externalMailboxConnection.findFirst({ where: { organizationId: proOrg.id, email: signinBody.email } })
    expect(proConnection).toBeNull()

    // La mailbox est attachée au NOUVEAU compte perso.
    const personalConnection = await prisma.externalMailboxConnection.findFirst({ where: { organizationId: res.body.organization.id, email: signinBody.email } })
    expect(personalConnection?.userId).toBe(res.body.user.id)
    expect(personalConnection?.status).toBe('connected')

    await cleanupOrg(proOrg.id)
    await cleanupOrg(res.body.organization.id)
  })
})
