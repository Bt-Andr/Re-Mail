import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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
})
