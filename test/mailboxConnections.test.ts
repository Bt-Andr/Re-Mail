import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'

const mockConnect = vi.fn()
const mockMailboxOpen = vi.fn()
const mockSearch = vi.fn()
const mockFetchOne = vi.fn()
const mockLogout = vi.fn()
const mockClose = vi.fn()
vi.mock('imapflow', () => ({
  ImapFlow: vi.fn().mockImplementation(function () {
    return {
      connect: mockConnect,
      mailboxOpen: mockMailboxOpen,
      search: mockSearch,
      fetchOne: mockFetchOne,
      logout: mockLogout,
      close: mockClose,
    }
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

function rawEmail(from: string, subject: string, body = 'Contenu.'): string {
  return `From: ${from}\r\nTo: moi@import-history-test.example\r\nSubject: ${subject}\r\nDate: ${new Date().toUTCString()}\r\n\r\n${body}`
}

describe('POST /api/mailbox-connections/:id/import-history', () => {
  let org: SeededOrg
  let connectionId: string

  beforeAll(async () => {
    org = await seedOrg('mailbox-history-import-test')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  beforeEach(async () => {
    mockConnect.mockReset().mockResolvedValue(undefined)
    mockMailboxOpen.mockReset().mockResolvedValue({ uidValidity: 1000n, uidNext: 50 })
    mockSearch.mockReset()
    mockFetchOne.mockReset()
    mockLogout.mockReset().mockResolvedValue(undefined)
    mockClose.mockReset()
    mockVerify.mockReset().mockResolvedValue(true)

    // uidNext (50) - 1 = 49 : tout ce qui est <= 49 est "avant la connexion", donc
    // hors de portée du polling normal — c'est justement ce que /import-history vise.
    const create = await request(app)
      .post('/api/mailbox-connections')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        email: 'moi@import-history-test.example',
        imapHost: 'imap.example.com',
        imapPort: 993,
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        password: 'x',
      })
    connectionId = create.body.id
  })

  afterEach(async () => {
    await prisma.externalMailboxConnection.deleteMany({ where: { id: connectionId } })
  })

  it('returns 404 for a connection owned by someone else', async () => {
    const other = await seedOrg('mailbox-history-import-other')
    const res = await request(app)
      .post(`/api/mailbox-connections/${connectionId}/import-history`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({})
    expect(res.status).toBe(404)
    await cleanupOrg(other.organizationId)
  })

  it('imports only messages at or before the connection cursor, ignores newer ones, and is a one-time action', async () => {
    mockSearch.mockResolvedValueOnce([10, 20, 60]) // 60 > lastSeenUid (49) — déjà couvert par le polling normal
    mockFetchOne.mockImplementation(async (uid: string) => ({
      source: Buffer.from(rawEmail(`ancien-${uid}@example.com`, `Vieux message ${uid}`)),
    }))

    const res = await request(app)
      .post(`/api/mailbox-connections/${connectionId}/import-history`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ days: 30 })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(2)
    expect(mockFetchOne).toHaveBeenCalledTimes(2)

    const connection = await prisma.externalMailboxConnection.findUnique({ where: { id: connectionId } })
    expect(connection?.historyImportedAt).toBeTruthy()
    // Le curseur de polling normal n'est jamais touché par l'import.
    expect(connection?.lastSeenUid).toBe(49)

    const threads = await prisma.thread.findMany({ where: { organizationId: org.organizationId, canal: 'email' } })
    expect(threads.map(t => t.externalEmail).sort()).toEqual(['ancien-10@example.com', 'ancien-20@example.com'])

    // Deuxième appel : refusé, l'import est une action à usage unique par connexion.
    const replay = await request(app)
      .post(`/api/mailbox-connections/${connectionId}/import-history`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({})
    expect(replay.status).toBe(409)
  })

  it('appends a second historical message from the same sender to the same thread instead of duplicating it', async () => {
    mockSearch.mockResolvedValueOnce([10, 11])
    mockFetchOne.mockImplementation(async (uid: string) =>
      uid === '10'
        ? { source: Buffer.from(rawEmail('client@example.com', 'Premier message')) }
        : { source: Buffer.from(rawEmail('client@example.com', 'Deuxième message')) }
    )

    const res = await request(app)
      .post(`/api/mailbox-connections/${connectionId}/import-history`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(2)

    const threads = await prisma.thread.findMany({ where: { organizationId: org.organizationId, externalEmail: 'client@example.com' } })
    expect(threads).toHaveLength(1)
    const messages = await prisma.threadMessage.findMany({ where: { threadId: threads[0].id } })
    expect(messages).toHaveLength(2)
  })

  it('returns 400 and does not mark historyImportedAt when the IMAP connection fails', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Invalid credentials'))
    const res = await request(app)
      .post(`/api/mailbox-connections/${connectionId}/import-history`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({})
    expect(res.status).toBe(400)
    const connection = await prisma.externalMailboxConnection.findUnique({ where: { id: connectionId } })
    expect(connection?.historyImportedAt).toBeNull()
  })

  it('clamps an out-of-range days value instead of rejecting the request', async () => {
    mockSearch.mockResolvedValueOnce([])
    const res = await request(app)
      .post(`/api/mailbox-connections/${connectionId}/import-history`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ days: 99999 })
    expect(res.status).toBe(200)
    const [query] = mockSearch.mock.calls[0]
    const daysRequested = (Date.now() - query.since.getTime()) / (24 * 60 * 60 * 1000)
    expect(daysRequested).toBeCloseTo(90, 0) // HISTORY_IMPORT_MAX_DAYS
  })
})
