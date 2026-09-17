import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { decrypt } from '../src/lib/crypto'
import { cleanupOrg, seedOrg, type SeededOrg } from './helpers/seed'

describe('Mail configuration validation', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('mail-config')
  })

  beforeEach(async () => {
    await prisma.mailRoute.deleteMany({ where: { organizationId: org.organizationId } })
    await prisma.organization.update({
      where: { id: org.organizationId },
      data: {
        resendVerifiedDomain: null,
        webhookSecretEnc: null,
        webhookTestToken: null,
        webhookTestStartedAt: null,
        webhookVerifiedAt: null,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('exposes a detailed setup state derived from persisted proofs', async () => {
    const response = await request(app)
      .get('/api/organizations/me')
      .set('Authorization', `Bearer ${org.token}`)

    expect(response.status).toBe(200)
    expect(response.body.setupStatus).toEqual({
      resendConnected: true,
      domainSelected: false,
      webhookConfigured: false,
      webhookVerified: false,
      firstAddressConfigured: false,
      firstOutboundAt: null,
      firstInboundAt: null,
      operational: false,
    })
  })

  it('only selects a domain currently verified in the connected Resend account', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'domain-1', name: 'Mail.Example.com', status: 'verified' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await request(app)
      .post('/api/organizations/me/resend/select-domain')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ domain: ' MAIL.EXAMPLE.COM ' })

    expect(response.status).toBe(200)
    expect(response.body.resendVerifiedDomain).toBe('mail.example.com')
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/domains', {
      headers: { Authorization: 'Bearer re_test_fake_key' },
    })
  })

  it('lists only verified Resend domains when the onboarding resumes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'domain-1', name: 'Mail.Example.com', status: 'verified' },
          { id: 'domain-2', name: 'pending.example.com', status: 'pending' },
          { id: 'domain-3', name: 'READY.EXAMPLE.COM', status: 'VERIFIED' },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await request(app)
      .get('/api/organizations/me/resend/domains')
      .set('Authorization', `Bearer ${org.token}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ verifiedDomains: ['mail.example.com', 'ready.example.com'] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns contextual DNS records and requires a verified receiving MX record', async () => {
    await prisma.organization.update({
      where: { id: org.organizationId },
      data: { resendVerifiedDomain: 'mail.example.com' },
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'domain-1', name: 'mail.example.com', status: 'partially_verified' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'domain-1',
          name: 'mail.example.com',
          status: 'partially_verified',
          capabilities: { sending: 'enabled', receiving: 'enabled' },
          records: [
            {
              record: 'Receiving MX',
              name: 'mail.example.com',
              type: 'MX',
              value: 'inbound-smtp.us-east-1.amazonaws.com',
              ttl: 'Auto',
              status: 'pending',
              priority: 10,
            },
            {
              record: 'DKIM',
              name: 'resend._domainkey.mail.example.com',
              type: 'TXT',
              value: 'public-dkim-value',
              status: 'verified',
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const response = await request(app)
      .get('/api/organizations/me/resend/domain-status')
      .set('Authorization', `Bearer ${org.token}`)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      name: 'mail.example.com',
      sendingEnabled: true,
      receivingEnabled: true,
      receivingReady: false,
    })
    expect(response.body.records[0]).toEqual({
      record: 'Receiving MX',
      name: 'mail.example.com',
      type: 'MX',
      value: 'inbound-smtp.us-east-1.amazonaws.com',
      ttl: 'Auto',
      status: 'pending',
      priority: 10,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.resend.com/domains/domain-1', {
      headers: { Authorization: 'Bearer re_test_fake_key' },
    })
  })

  it('rejects an unknown or unverified domain without changing the organization', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'domain-1', name: 'mail.example.com', status: 'pending' }] }),
      })
    )

    const response = await request(app)
      .post('/api/organizations/me/resend/select-domain')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ domain: 'mail.example.com' })

    expect(response.status).toBe(400)
    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })
    expect(stored.resendVerifiedDomain).toBeNull()
  })

  it('does not select a new domain that would orphan existing aliases', async () => {
    await prisma.mailRoute.create({
      data: { organizationId: org.organizationId, alias: 'contact@old.example.com', personalEmail: '', active: true },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'domain-2', name: 'new.example.com', status: 'verified' }] }),
      })
    )

    const response = await request(app)
      .post('/api/organizations/me/resend/select-domain')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ domain: 'new.example.com' })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('contact@old.example.com')
    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })
    expect(stored.resendVerifiedDomain).toBeNull()
  })

  it('validates the Resend signing secret before encrypting it', async () => {
    const invalid = await request(app)
      .post('/api/organizations/me/resend/webhook-secret')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ webhookSecret: 'not-a-resend-secret' })
    expect(invalid.status).toBe(400)

    const secret = 'whsec_dGVzdHNlY3JldGZvcnRlc3RzMTIzNDU2Nzg5MA=='
    const valid = await request(app)
      .post('/api/organizations/me/resend/webhook-secret')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ webhookSecret: secret })
    expect(valid.status).toBe(200)

    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })
    expect(stored.webhookSecretEnc).not.toBe(secret)
    expect(decrypt(stored.webhookSecretEnc!)).toBe(secret)
  })

  it('verifies the webhook only after receiving the generated test address', async () => {
    await prisma.organization.update({
      where: { id: org.organizationId },
      data: { resendVerifiedDomain: 'mail.example.com' },
    })
    const configured = await request(app)
      .post('/api/organizations/me/resend/webhook-secret')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ webhookSecret: org.webhookSecret })
    expect(configured.status).toBe(200)

    const started = await request(app)
      .post('/api/organizations/me/resend/webhook-test/start')
      .set('Authorization', `Bearer ${org.token}`)
      .send()
    expect(started.status).toBe(200)
    expect(started.body).toMatchObject({ started: true, verified: false })
    expect(started.body.testAddress).toMatch(/^setup\+[a-f0-9]{16}@mail\.example\.com$/)

    await prisma.inboundEvent.create({
      data: {
        organizationId: org.organizationId,
        provider: 'resend',
        externalId: `unrelated-setup-test-${Date.now()}`,
        payload: { data: { to: ['someone-else@mail.example.com'], from: 'sender@example.com' } },
        status: 'completed',
        processedAt: new Date(),
      },
    })

    const pending = await request(app)
      .get('/api/organizations/me/resend/webhook-test')
      .set('Authorization', `Bearer ${org.token}`)
    expect(pending.body.verified).toBe(false)

    await prisma.inboundEvent.create({
      data: {
        organizationId: org.organizationId,
        provider: 'resend',
        externalId: `setup-test-${Date.now()}`,
        payload: { data: { to: [started.body.testAddress], from: 'sender@example.com' } },
        status: 'completed',
        processedAt: new Date(),
      },
    })

    const verified = await request(app)
      .get('/api/organizations/me/resend/webhook-test')
      .set('Authorization', `Bearer ${org.token}`)
    expect(verified.status).toBe(200)
    expect(verified.body).toMatchObject({
      started: true,
      verified: true,
      testAddress: started.body.testAddress,
    })

    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: org.organizationId } })
    expect(stored.webhookVerifiedAt).not.toBeNull()
  })

  it('accepts aliases only on the configured domain and validates forwarding addresses', async () => {
    await prisma.organization.update({
      where: { id: org.organizationId },
      data: { resendVerifiedDomain: 'mail.example.com' },
    })

    const valid = await request(app)
      .post('/api/mail-routes')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ alias: ' Contact@MAIL.EXAMPLE.COM ', personalEmail: ' Owner@Example.com ' })
    expect(valid.status).toBe(201)
    expect(valid.body).toMatchObject({ alias: 'contact@mail.example.com', personalEmail: 'owner@example.com' })

    const wrongDomain = await request(app)
      .post('/api/mail-routes')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ alias: 'sales@other.example.com' })
    expect(wrongDomain.status).toBe(400)

    const invalidForward = await request(app)
      .post('/api/mail-routes')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ alias: 'sales@mail.example.com', personalEmail: 'not-an-email' })
    expect(invalidForward.status).toBe(400)
    expect(await prisma.mailRoute.count({ where: { organizationId: org.organizationId } })).toBe(1)
  })

  it('reports invalid bulk aliases per row and never persists them', async () => {
    await prisma.organization.update({
      where: { id: org.organizationId },
      data: { resendVerifiedDomain: 'mail.example.com' },
    })

    const response = await request(app)
      .post('/api/mail-routes/bulk')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        routes: [
          { alias: 'contact@mail.example.com' },
          { alias: 'sales@other.example.com' },
          { alias: 'support@mail.example.com', personalEmail: 'invalid' },
        ],
      })

    expect(response.status).toBe(200)
    expect(response.body.created).toHaveLength(1)
    expect(response.body.skipped).toEqual([
      { alias: 'sales@other.example.com', reason: 'alias hors du domaine mail.example.com' },
      { alias: 'support@mail.example.com', reason: 'alias ou personalEmail invalide' },
    ])
    expect(await prisma.mailRoute.count({ where: { organizationId: org.organizationId } })).toBe(1)
  })

  it('rejects a domain change on an existing alias and leaves it untouched', async () => {
    await prisma.organization.update({
      where: { id: org.organizationId },
      data: { resendVerifiedDomain: 'mail.example.com' },
    })
    const route = await prisma.mailRoute.create({
      data: { organizationId: org.organizationId, alias: 'contact@mail.example.com', personalEmail: '', active: true },
    })

    const response = await request(app)
      .put(`/api/mail-routes/${route.id}`)
      .set('Authorization', `Bearer ${org.token}`)
      .send({ alias: 'contact@other.example.com' })

    expect(response.status).toBe(400)
    const stored = await prisma.mailRoute.findUniqueOrThrow({ where: { id: route.id } })
    expect(stored.alias).toBe('contact@mail.example.com')
  })
})
