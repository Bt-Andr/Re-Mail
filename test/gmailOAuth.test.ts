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

async function getSignedSigninState(returnTo: string) {
  const res = await request(app).get('/api/mailbox-connections/gmail/start-signin').query({ returnTo })
  expect(res.status).toBe(200)
  const authUrl = new URL(res.body.url)
  return authUrl.searchParams.get('state')!
}

// Nettoie tout compte perso créé à la volée par le flux signin — les tests de cette
// section réutilisent tous la même adresse mockée (moi@gmail.com) et doivent repartir
// d'un état propre à chaque fois.
async function cleanupSigninAccount() {
  const leftover = await prisma.user.findUnique({ where: { email: 'moi@gmail.com' } })
  if (leftover) await cleanupOrg(leftover.organizationId)
}

describe('Gmail OAuth', () => {
  let org: SeededOrg
  const returnTo = 'http://localhost:5174/mailboxes'
  const signinReturnTo = 'http://localhost:5174/auth/google/callback'
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

  describe('GET /gmail/start-signin', () => {
    it('requires no authentication and returns a well-formed authorization URL for the signin returnTo', async () => {
      const res = await request(app).get('/api/mailbox-connections/gmail/start-signin').query({ returnTo: signinReturnTo })
      expect(res.status).toBe(200)
      const url = new URL(res.body.url)
      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(url.searchParams.get('state')).toBeTruthy()
    })

    it('rejects a returnTo that is only allowed for the connect intent (e.g. /mailboxes)', async () => {
      const res = await request(app).get('/api/mailbox-connections/gmail/start-signin').query({ returnTo })
      expect(res.status).toBe(400)
    })

    it('rejects a missing/disallowed returnTo', async () => {
      const res = await request(app).get('/api/mailbox-connections/gmail/start-signin')
      expect(res.status).toBe(400)

      const evil = await request(app).get('/api/mailbox-connections/gmail/start-signin').query({ returnTo: 'https://evil.example.com/steal' })
      expect(evil.status).toBe(400)
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

    describe('intent: signin', () => {
      afterEach(cleanupSigninAccount)

      it('creates a new personal account, connects the mailbox, and redirects with ?handoff=', async () => {
        const state = await getSignedSigninState(signinReturnTo)
        const res = await request(app).get('/api/mailbox-connections/gmail/callback').query({ code: 'auth-code', state }).redirects(0)

        expect(res.status).toBe(302)
        expect(res.headers.location.startsWith(signinReturnTo)).toBe(true)
        const location = new URL(res.headers.location)
        expect(location.searchParams.get('handoff')).toBeTruthy()
        expect(location.searchParams.get('error')).toBeNull()

        const user = await prisma.user.findUnique({ where: { email: 'moi@gmail.com' }, include: { organization: true } })
        expect(user).toBeTruthy()
        expect(user?.orgRole).toBe('OWNER')
        expect(user?.organization.isPersonal).toBe(true)

        const connection = await prisma.externalMailboxConnection.findFirst({ where: { organizationId: user!.organizationId, email: 'moi@gmail.com' } })
        expect(connection?.provider).toBe('gmail')
        expect(connection?.userId).toBe(user!.id)
      })

      it('signs an existing personal-account user back in without creating a duplicate account, refreshing the mailbox connection', async () => {
        // Pré-crée le compte perso "à la main" (hors flux OAuth) pour simuler un
        // utilisateur qui s'est déjà connecté via Google une première fois.
        const organization = await prisma.organization.create({
          data: { name: 'Moi (perso)', slug: `moi-perso-${Date.now()}`, isPersonal: true },
        })
        const user = await prisma.user.create({
          data: {
            organizationId: organization.id,
            username: `moi-${Date.now()}`,
            email: 'moi@gmail.com',
            password: 'unused-random-hash',
            nom: 'Moi',
            orgRole: 'OWNER',
          },
        })

        const state = await getSignedSigninState(signinReturnTo)
        const res = await request(app).get('/api/mailbox-connections/gmail/callback').query({ code: 'auth-code', state }).redirects(0)
        expect(res.status).toBe(302)
        const location = new URL(res.headers.location)
        expect(location.searchParams.get('handoff')).toBeTruthy()

        const usersWithEmail = await prisma.user.findMany({ where: { email: 'moi@gmail.com' } })
        expect(usersWithEmail).toHaveLength(1)
        expect(usersWithEmail[0].id).toBe(user.id) // même compte, pas un doublon

        const connection = await prisma.externalMailboxConnection.findFirst({ where: { organizationId: organization.id, email: 'moi@gmail.com' } })
        expect(connection?.userId).toBe(user.id)
      })

      it('connects the mailbox to an existing pro (team) account but issues no session — password still required', async () => {
        const proOrg = await prisma.organization.create({
          data: { name: 'Pro Co', slug: `pro-co-${Date.now()}`, isPersonal: false },
        })
        const proUser = await prisma.user.create({
          data: {
            organizationId: proOrg.id,
            username: `pro-owner-${Date.now()}`,
            email: 'moi@gmail.com',
            password: 'unused-random-hash',
            nom: 'Pro Owner',
            orgRole: 'OWNER',
          },
        })

        const state = await getSignedSigninState(signinReturnTo)
        const res = await request(app).get('/api/mailbox-connections/gmail/callback').query({ code: 'auth-code', state }).redirects(0)
        expect(res.status).toBe(302)
        // Code d'erreur générique et volontairement partagé avec les échecs internes
        // (voir gmailOAuth.ts) : un code dédié laisserait deviner qu'une adresse donnée
        // est un compte d'équipe à quiconque complète l'OAuth Google pour cette adresse.
        expect(res.headers.location).toBe(`${signinReturnTo}?error=account_provisioning_failed`)

        // Aucune session émise — réussir l'OAuth Google ne doit jamais, à lui seul,
        // déverrouiller un compte pro (portée du raccourci "signin" limitée au perso).
        const handoffCount = await prisma.loginHandoff.count({ where: { user: { email: 'moi@gmail.com' } } })
        expect(handoffCount).toBe(0)

        // Mais le Gmail est bien rattaché à ce compte pro, prêt dès la connexion par mot
        // de passe — évite une manipulation manuelle redondante dans Boîtes externes.
        const connection = await prisma.externalMailboxConnection.findFirst({ where: { organizationId: proOrg.id, email: 'moi@gmail.com' } })
        expect(connection?.userId).toBe(proUser.id)
        expect(connection?.status).toBe('connected')

        await cleanupOrg(proOrg.id)
      })
    })
  })
})
