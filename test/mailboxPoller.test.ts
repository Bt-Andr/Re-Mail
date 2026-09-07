import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

const mockConnect = vi.fn()
const mockMailboxOpen = vi.fn()
const mockLogout = vi.fn()
const mockClose = vi.fn()
const mockFetch = vi.fn()
vi.mock('imapflow', () => ({
  ImapFlow: vi.fn().mockImplementation(function () {
    return { connect: mockConnect, mailboxOpen: mockMailboxOpen, logout: mockLogout, close: mockClose, fetch: mockFetch }
  }),
}))

import prisma from '../src/lib/prisma'
import { encryptMailboxCredential } from '../src/lib/mailboxCredentialCrypto'
import { pollAllMailboxes, pollConnection } from '../src/jobs/mailboxPoller'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

const RAW_MESSAGE = Buffer.from(
  'From: "Jean Dupont" <jean@example.com>\r\n' +
    'Subject: Bonjour\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    '\r\n' +
    '<p>Un message de test.</p>\r\n'
)

async function* oneMessage() {
  yield { uid: 51, source: RAW_MESSAGE }
}

describe('mailboxPoller.pollConnection', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('poller-test')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  beforeEach(() => {
    mockConnect.mockReset().mockResolvedValue(undefined)
    mockMailboxOpen.mockReset().mockResolvedValue({ uidValidity: 1000n, uidNext: 52 })
    mockLogout.mockReset().mockResolvedValue(undefined)
    mockClose.mockReset()
    mockFetch.mockReset().mockImplementation(() => oneMessage())
  })

  it('creates an IMAP message once, assigns it, advances the UID, and deduplicates a retry with a stale cursor', async () => {
    const connection = await prisma.externalMailboxConnection.create({
      data: {
        organizationId: org.organizationId,
        userId: org.userId,
        provider: 'imap',
        email: 'moi@example.com',
        imapHost: 'imap.example.com',
        imapPort: 993,
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        credentialEnc: encryptMailboxCredential('password'),
        status: 'connected',
        lastSeenUid: 50,
      },
    })

    await pollConnection(connection)

    const thread = await prisma.thread.findFirst({ where: { organizationId: org.organizationId, externalEmail: 'jean@example.com' } })
    expect(thread).not.toBeNull()
    expect(thread?.assignedToId).toBe(org.userId)
    expect(thread?.canal).toBe('email')

    const message = await prisma.threadMessage.findFirst({ where: { threadId: thread!.id } })
    expect(message?.body).toContain('Un message de test.')
    expect(message?.direction).toBe('inbound')
    expect(message?.inboundEventId).not.toBeNull()

    const updated = await prisma.externalMailboxConnection.findUnique({ where: { id: connection.id } })
    expect(updated?.lastSeenUid).toBe(51)
    expect(updated?.uidValidity).toBe(1000n)
    expect(updated?.status).toBe('connected')

    // Simule un retry avec l'ancien objet de connexion, par exemple après un crash
    // entre l'insertion du message et le rechargement du curseur en mémoire.
    await pollConnection(connection)
    expect(await prisma.threadMessage.count({ where: { threadId: thread!.id } })).toBe(1)
    expect(
      await prisma.inboundEvent.count({
        where: { organizationId: org.organizationId, provider: 'imap' },
      })
    ).toBe(1)
  })

  it('does nothing when there is no new UID to fetch', async () => {
    mockMailboxOpen.mockResolvedValue({ uidValidity: 1000n, uidNext: 51 })
    const connection = await prisma.externalMailboxConnection.create({
      data: {
        organizationId: org.organizationId,
        userId: org.userId,
        provider: 'imap',
        email: 'rien-de-nouveau@example.com',
        imapHost: 'imap.example.com',
        imapPort: 993,
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        credentialEnc: encryptMailboxCredential('password'),
        status: 'connected',
        lastSeenUid: 50,
      },
    })

    await pollConnection(connection)

    expect(mockFetch).not.toHaveBeenCalled()
    const updated = await prisma.externalMailboxConnection.findUnique({ where: { id: connection.id } })
    expect(updated?.lastSeenUid).toBe(50)
  })

  it('resets lastSeenUid to 0 when uidValidity changes (server renumbering)', async () => {
    mockMailboxOpen.mockResolvedValue({ uidValidity: 2000n, uidNext: 1 })
    const connection = await prisma.externalMailboxConnection.create({
      data: {
        organizationId: org.organizationId,
        userId: org.userId,
        provider: 'imap',
        email: 'renumbered@example.com',
        imapHost: 'imap.example.com',
        imapPort: 993,
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        credentialEnc: encryptMailboxCredential('password'),
        status: 'connected',
        lastSeenUid: 999,
        uidValidity: 1000n,
      },
    })

    await pollConnection(connection)

    expect(mockFetch).not.toHaveBeenCalled() // uidNext(1) - 1 = 0, pas > 0 (lastSeenUid reset)
    const updated = await prisma.externalMailboxConnection.findUnique({ where: { id: connection.id } })
    expect(updated?.uidValidity).toBe(2000n)
    expect(updated?.lastSeenUid).toBe(0)
  })

  it('does not start a second polling cycle while the first one is still running', async () => {
    let releaseQuery!: (value: []) => void
    const pendingQuery = new Promise<[]>(resolve => {
      releaseQuery = resolve
    })
    const findMany = vi
      .spyOn(prisma.externalMailboxConnection, 'findMany')
      .mockImplementationOnce(() => pendingQuery as never)

    const firstCycle = pollAllMailboxes()
    await Promise.resolve()
    const secondCycle = pollAllMailboxes()

    await secondCycle
    expect(findMany).toHaveBeenCalledTimes(1)

    releaseQuery([])
    await firstCycle
    findMany.mockRestore()
  })
})
