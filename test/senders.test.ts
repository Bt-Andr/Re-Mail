import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '../src/lib/prisma'
import { forOrg } from '../src/middleware/scopedPrisma'
import { getAllowedSenders } from '../src/helpers/senders'
import { encryptMailboxCredential } from '../src/lib/mailboxCredentialCrypto'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

describe('getAllowedSenders — boîtes externes connectées', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('senders-mailbox-test')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('includes a connected external mailbox as an allowed sender', async () => {
    const db = forOrg(org.organizationId)
    await db.externalMailboxConnection.create({
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
      },
    })

    const senders = await getAllowedSenders(db, org.userId)
    expect(senders.some(s => s.email === 'moi@example.com')).toBe(true)
  })

  it('does not include a mailbox connection with status "error"', async () => {
    const db = forOrg(org.organizationId)
    await db.externalMailboxConnection.create({
      data: {
        organizationId: org.organizationId,
        userId: org.userId,
        provider: 'imap',
        email: 'broken@example.com',
        imapHost: 'imap.example.com',
        imapPort: 993,
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        credentialEnc: encryptMailboxCredential('password'),
        status: 'error',
        lastError: 'Connexion impossible',
      },
    })

    const senders = await getAllowedSenders(db, org.userId)
    expect(senders.some(s => s.email === 'broken@example.com')).toBe(false)
  })

  it('includes a claimed pro address (ThreadRoutingRule) as an allowed sender', async () => {
    await prisma.organization.update({ where: { id: org.organizationId }, data: { resendVerifiedDomain: 'senders-test.example' } })

    const db = forOrg(org.organizationId)
    await db.threadRoutingRule.create({
      data: { organizationId: org.organizationId, canal: 'contact', assignToId: org.userId, active: true, claimedAt: new Date() },
    })

    const senders = await getAllowedSenders(db, org.userId)
    expect(senders.some(s => s.email === 'contact@senders-test.example')).toBe(true)
  })

  it('does not include a pro address that has been attributed but not yet claimed', async () => {
    const db = forOrg(org.organizationId)
    await db.threadRoutingRule.create({
      data: { organizationId: org.organizationId, canal: 'nonclaimed', assignToId: org.userId, active: true },
    })

    const senders = await getAllowedSenders(db, org.userId)
    expect(senders.some(s => s.email === 'nonclaimed@senders-test.example')).toBe(false)
  })
})
