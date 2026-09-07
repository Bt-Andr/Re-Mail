import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'
import { signTestWebhook } from './helpers/webhookSigner'

function mockResendFetch() {
  return vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = input.toString()
    if (url.includes('/emails/receiving/') && url.endsWith('/attachments')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    }
    if (url.includes('/emails/receiving/')) {
      return new Response(JSON.stringify({ html: '<p>Bonjour, ceci est un test.</p>', text: 'Bonjour, ceci est un test.' }), { status: 200 })
    }
    if (url.includes('api.resend.com/emails')) {
      return new Response(JSON.stringify({ id: 're_sent_test' }), { status: 200 })
    }
    return new Response('not found', { status: 404 })
  }) as unknown as typeof fetch
}

describe('POST /api/inbound-mail/:webhookToken', () => {
  let org: SeededOrg
  const originalFetch = global.fetch

  beforeAll(async () => {
    org = await seedOrg('inbound-test')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  beforeEach(() => {
    global.fetch = mockResendFetch()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  function payload(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      type: 'email.received',
      data: {
        email_id: 're_inbound_1',
        from: 'Client Test <client@example.com>',
        to: ['contact@testco.example'],
        subject: 'Question sur vos services',
        ...overrides,
      },
    })
  }

  it('returns 404 for an unknown webhook token', async () => {
    const body = payload()
    const headers = signTestWebhook(org.webhookSecret, body)
    const res = await request(app)
      .post('/api/inbound-mail/does-not-exist')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(body)
    expect(res.status).toBe(404)
  })

  it('returns 401 for a badly signed payload', async () => {
    const body = payload()
    const res = await request(app)
      .post(`/api/inbound-mail/${org.webhookToken}`)
      .set('svix-id', 'msg_bad')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,not-a-valid-signature')
      .set('Content-Type', 'application/json')
      .send(body)
    expect(res.status).toBe(401)
  })

  it('returns 500 instead of acknowledging when durable persistence fails', async () => {
    const body = payload({ email_id: 're_inbound_persistence_failure' })
    const headers = signTestWebhook(org.webhookSecret, body)
    const create = vi
      .spyOn(prisma.inboundEvent, 'create')
      .mockRejectedValueOnce(new Error('database temporarily unavailable'))

    const res = await request(app)
      .post(`/api/inbound-mail/${org.webhookToken}`)
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(body)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Réception temporairement indisponible')
    create.mockRestore()
    expect(
      await prisma.inboundEvent.count({
        where: {
          organizationId: org.organizationId,
          provider: 'resend',
          externalId: headers['svix-id'],
        },
      })
    ).toBe(0)
  })

  it('accepts a validly signed payload and creates a thread', async () => {
    const body = payload()
    const headers = signTestWebhook(org.webhookSecret, body)
    const res = await request(app)
      .post(`/api/inbound-mail/${org.webhookToken}`)
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(body)
    expect(res.status).toBe(200)

    // Le traitement est asynchrone (réponse envoyée avant le traitement complet) :
    // on attend que le thread apparaisse en base.
    let thread = null
    for (let i = 0; i < 20 && !thread; i++) {
      thread = await prisma.thread.findFirst({ where: { organizationId: org.organizationId, externalEmail: 'client@example.com' } })
      if (!thread) await new Promise(r => setTimeout(r, 100))
    }

    expect(thread).not.toBeNull()
    expect(thread?.canal).toBe('contact')
    expect(thread?.sujet).toBe('Question sur vos services')

    const messages = await prisma.threadMessage.findMany({ where: { threadId: thread!.id } })
    expect(messages).toHaveLength(1)
    expect(messages[0].direction).toBe('inbound')
    expect(messages[0].body).toContain('Bonjour, ceci est un test.')
  })

  it('persists and processes the same Svix event only once when Resend retries it', async () => {
    const body = payload({
      email_id: 're_inbound_duplicate',
      from: 'Duplicate Test <duplicate@example.com>',
      subject: 'Événement rejoué',
    })
    const headers = signTestWebhook(org.webhookSecret, body)

    const [first, retry] = await Promise.all([
      request(app)
        .post(`/api/inbound-mail/${org.webhookToken}`)
        .set(headers)
        .set('Content-Type', 'application/json')
        .send(body),
      request(app)
        .post(`/api/inbound-mail/${org.webhookToken}`)
        .set(headers)
        .set('Content-Type', 'application/json')
        .send(body),
    ])

    expect(first.status).toBe(200)
    expect(retry.status).toBe(200)

    const externalId = headers['svix-id']
    let event = null
    for (let i = 0; i < 30 && event?.status !== 'completed'; i++) {
      event = await prisma.inboundEvent.findFirst({
        where: { organizationId: org.organizationId, provider: 'resend', externalId },
      })
      if (event?.status !== 'completed') await new Promise(resolve => setTimeout(resolve, 100))
    }

    expect(event?.status).toBe('completed')
    expect(event?.attemptCount).toBe(1)
    expect(
      await prisma.inboundEvent.count({
        where: { organizationId: org.organizationId, provider: 'resend', externalId },
      })
    ).toBe(1)

    const thread = await prisma.thread.findFirst({
      where: { organizationId: org.organizationId, externalEmail: 'duplicate@example.com' },
    })
    expect(thread).not.toBeNull()
    expect(await prisma.threadMessage.count({ where: { threadId: thread!.id } })).toBe(1)
  })
})
