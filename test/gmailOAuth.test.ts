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

import app from '../src/app'
import prisma from '../src/lib/prisma'
import { encryptMailboxCredential, decryptMailboxCredential } from '../src/lib/mailboxCredentialCrypto'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

async function getSignedState(token: string, returnTo: string) {
  const res = await request(app).get('/api/mailbox-connections/gmail/start').query({ returnTo }).set('Authorization', `Bearer ${token}`)
  expect(res.status).toBe(200)
  const authUrl = new URL(res.body.url)
  return authUrl.searchParams.get('state')!
}

describe('Gmail OAuth', () => {
  let org: SeededOrg
  const returnTo = 'http://localhost:5173/mailboxes'
  const originalFetch = global.fetch

  beforeAll(async () => {
    org = await seedOrg('gmail-oauth-test')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  beforeEach(async () => {
    // Isolation entre tests : plusieurs tests de ce fichier créent une connexion pour la
    // même adresse mockée (moi@gmail.com) sur la même org partagée.
    await prisma.externalMailboxConnection.deleteMany({ where: { organizationId: org.organizationId } })
    mockConnect.mockReset().mockResolvedValue(undefined)
    mockMailboxOpen.mockReset().mockResolvedValue({ uidValidity: 1000n, uidNext: 10 })
    mockLogout.mockReset().mockResolvedValue(undefined)
    mockClose.mockReset()
    global.fetch = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input.toString()
      if (url === TOKEN_URL) return new Response(JSON.stringify({ access_token: 'access-1', refresh_token: 'refresh-1' }), { status: 200 })
      if (url === USERINFO_URL) return new Response(JSON.stringify({ email: 'moi@gmail.com' }), { status: 200 })
      return new Response('not found', { status: 404 })
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('GET /gmail/start', () => {
    it('rejects a missing/disallowed returnTo without signing any state', async () => {
      const res = await request(app).get('/api/mailbox-connections/gmail/start').set('Authorization', `Bearer ${org.token}`)
      expect(res.status).toBe(400)

      const evil = await request(app)
        .get('/api/mailbox-connections/gmail/start')
        .query({ returnTo: 'https://evil.example.com/steal' })
        .set('Authorization', `Bearer ${org.token}`)
      expect(evil.status).toBe(400)
    })

    it('returns a well-formed authorization URL for an allowed returnTo', async () => {
      const res = await request(app).get('/api/mailbox-connections/gmail/start').query({ returnTo }).set('Authorization', `Bearer ${org.token}`)
      expect(res.status).toBe(200)
      const url = new URL(res.body.url)
      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(url.searchParams.get('state')).toBeTruthy()
    })

    it('requires authentication', async () => {
      const res = await request(app).get('/api/mailbox-connections/gmail/start').query({ returnTo })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /gmail/callback', () => {
    it('completes the flow: creates the connection and redirects to returnTo', async () => {
      const state = await getSignedState(org.token, returnTo)
      const res = await request(app).get('/api/mailbox-connections/gmail/callback').query({ code: 'auth-code', state }).redirects(0)

      expect(res.status).toBe(302)
      expect(res.headers.location).toBe(returnTo)

      const connection = await prisma.externalMailboxConnection.findFirst({ where: { organizationId: org.organizationId, email: 'moi@gmail.com' } })
      expect(connection?.provider).toBe('gmail')
      expect(connection?.imapHost).toBe('imap.gmail.com')
      expect(connection?.imapPort).toBe(993)
      expect(connection?.smtpHost).toBe('smtp.gmail.com')
      expect(connection?.smtpPort).toBe(465)
      expect(connection?.status).toBe('connected')
      expect(connection?.credentialEnc).not.toContain('refresh-1')
    })

    it('reconnecting an already-errored address updates it instead of creating a duplicate', async () => {
      const state = await getSignedState(org.token, returnTo)
      await request(app).get('/api/mailbox-connections/gmail/callback').query({ code: 'auth-code', state }).redirects(0)
      await prisma.externalMailboxConnection.updateMany({
        where: { organizationId: org.organizationId, email: 'moi@gmail.com' },
        data: { status: 'error', lastError: 'expired' },
      })

      const state2 = await getSignedState(org.token, returnTo)
      const res = await request(app).get('/api/mailbox-connections/gmail/callback').query({ code: 'auth-code', state: state2 }).redirects(0)
      expect(res.status).toBe(302)
      expect(res.headers.location).toBe(returnTo)

      const connections = await prisma.externalMailboxConnection.findMany({ where: { organizationId: org.organizationId, email: 'moi@gmail.com' } })
      expect(connections).toHaveLength(1)
      expect(connections[0].status).toBe('connected')
      expect(connections[0].lastError).toBeNull()
    })

    it('upgrades a pre-existing generic IMAP connection for the same address to provider: gmail', async () => {
      await prisma.externalMailboxConnection.create({
        data: {
          organizationId: org.organizationId,
          userId: org.userId,
          provider: 'imap',
          email: 'moi@gmail.com',
          imapHost: 'imap.gmail.com',
          imapPort: 993,
          smtpHost: 'smtp.gmail.com',
          smtpPort: 465,
          credentialEnc: encryptMailboxCredential('an-old-app-password'),
          status: 'connected',
        },
      })

      const state = await getSignedState(org.token, returnTo)
      const res = await request(app).get('/api/mailbox-connections/gmail/callback').query({ code: 'auth-code', state }).redirects(0)
      expect(res.status).toBe(302)
      expect(res.headers.location).toBe(returnTo)

      const connections = await prisma.externalMailboxConnection.findMany({ where: { organizationId: org.organizationId, email: 'moi@gmail.com' } })
      expect(connections).toHaveLength(1)
      // provider doit passer à 'gmail' — sinon getMailboxAuth traiterait le refresh token
      // qui vient d'être stocké comme s'il s'agissait encore d'un mot de passe classique.
      expect(connections[0].provider).toBe('gmail')
      expect(connections[0].credentialEnc).not.toContain('an-old-app-password')
    })

    it('refuses to reassign a connection already owned by a different user in the same org', async () => {
      const otherUser = await prisma.user.create({
        data: {
          organizationId: org.organizationId,
          username: `${org.username}-other`,
          email: `${org.username}-other@test-co.example`,
          password: 'irrelevant',
          nom: 'Autre utilisateur',
          orgRole: 'MEMBER',
        },
      })
      await prisma.externalMailboxConnection.create({
        data: {
          organizationId: org.organizationId,
          userId: otherUser.id,
          provider: 'gmail',
          email: 'moi@gmail.com',
          imapHost: 'imap.gmail.com',
          imapPort: 993,
          smtpHost: 'smtp.gmail.com',
          smtpPort: 465,
          credentialEnc: encryptMailboxCredential('other-users-refresh-token'),
          status: 'connected',
        },
      })

      const state = await getSignedState(org.token, returnTo)
      const res = await request(app).get('/api/mailbox-connections/gmail/callback').query({ code: 'auth-code', state }).redirects(0)
      expect(res.status).toBe(302)
      expect(res.headers.location).toBe(`${returnTo}?error=already_connected_by_another_user`)

      const connection = await prisma.externalMailboxConnection.findFirst({ where: { organizationId: org.organizationId, email: 'moi@gmail.com' } })
      expect(connection?.userId).toBe(otherUser.id) // inchangé — pas réassigné à l'appelant du callback
      expect(decryptMailboxCredential(connection!.credentialEnc)).toBe('other-users-refresh-token') // pas écrasé
    })

    it('redirects with ?error=oauth_denied when the user cancels consent, without attempting a token exchange', async () => {
      const state = await getSignedState(org.token, returnTo)
      const res = await request(app).get('/api/mailbox-connections/gmail/callback').query({ error: 'access_denied', state }).redirects(0)
      expect(res.status).toBe(302)
      expect(res.headers.location).toBe(`${returnTo}?error=oauth_denied`)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('redirects with ?error=state_invalid for a missing/tampered state', async () => {
      const res = await request(app).get('/api/mailbox-connections/gmail/callback').query({ code: 'auth-code', state: 'not-a-valid-token' }).redirects(0)
      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('error=state_invalid')
    })

    it('redirects with ?error=token_exchange_failed when Google rejects the code', async () => {
      global.fetch = vi.fn(async () => new Response('bad request', { status: 400 })) as unknown as typeof fetch
      const state = await getSignedState(org.token, returnTo)
      const res = await request(app).get('/api/mailbox-connections/gmail/callback').query({ code: 'auth-code', state }).redirects(0)
      expect(res.status).toBe(302)
      expect(res.headers.location).toBe(`${returnTo}?error=token_exchange_failed`)

      const connection = await prisma.externalMailboxConnection.findFirst({ where: { organizationId: org.organizationId, email: 'moi@gmail.com' } })
      expect(connection).toBeNull()
    })
  })
})
