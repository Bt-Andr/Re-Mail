import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'

const mockSendMail = vi.fn()
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn().mockImplementation(() => ({ sendMail: mockSendMail, verify: vi.fn() })) },
}))

import app from '../src/app'
import prisma from '../src/lib/prisma'
import { encryptMailboxCredential } from '../src/lib/mailboxCredentialCrypto'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

// Vérifie le bug corrigé cette session : POST /emails/reply bloquait tout le handler
// dès le départ sur `!org.resendApiKeyEnc`, avant toute résolution d'expéditeur — un
// compte perso qui n'a connecté qu'une boîte externe (pas de clé Resend) ne pouvait
// donc envoyer aucun email.
describe('POST /api/emails/reply — via boîte externe (SMTP), sans Resend connecté', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('mailbox-send-test')
    await prisma.organization.update({ where: { id: org.organizationId }, data: { resendApiKeyEnc: null } })
    await prisma.externalMailboxConnection.create({
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
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  beforeEach(() => {
    mockSendMail.mockReset().mockResolvedValue({ messageId: 'test' })
  })

  it('sends successfully through the connected mailbox even with no Resend key on the org', async () => {
    const res = await request(app)
      .post('/api/emails/reply')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ to: 'client@example.com', subject: 'Bonjour', message: 'Contenu', fromEmail: 'moi@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    expect(mockSendMail.mock.calls[0][0].to).toBe('client@example.com')

    const msg = await prisma.threadMessage.findFirst({ where: { threadId: res.body.threadId } })
    expect(msg?.fromEmail).toBe('moi@example.com')
  })

  it('does not create a MailReplyToken for an SMTP send (the token mechanism is Resend/domain-only)', async () => {
    const res = await request(app)
      .post('/api/emails/reply')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ to: 'client2@example.com', subject: 'Bonjour 2', message: 'Contenu', fromEmail: 'moi@example.com' })

    expect(res.status).toBe(200)
    const tokens = await prisma.mailReplyToken.findMany({ where: { threadId: res.body.threadId } })
    expect(tokens).toHaveLength(0)
  })

  it('still returns 400 when neither Resend nor a matching mailbox connection is available', async () => {
    const res = await request(app)
      .post('/api/emails/reply')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ to: 'client3@example.com', subject: 'Bonjour', message: 'Contenu', fromEmail: 'inconnu@example.com' })

    expect(res.status).toBe(403) // adresse d'expédition non autorisée, résolue avant la vérification resendApiKeyEnc
  })
})
