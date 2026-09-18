import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'
import { signTestWebhook } from './helpers/webhookSigner'

function mockResendFetch(receivedEmail: Record<string, unknown> = {}) {
  return vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = input.toString()
    if (url.includes('/emails/receiving/') && url.endsWith('/attachments')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    }
    if (url.includes('/emails/receiving/')) {
      return new Response(
        JSON.stringify({ html: '<p>Bonjour, ceci est un test.</p>', text: 'Bonjour, ceci est un test.', ...receivedEmail }),
        { status: 200 }
      )
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

  it('keeps an address without personal forwarding fully usable for inbound mail', async () => {
    const address = `no-forward-${Date.now()}@testco.example`
    await prisma.mailRoute.create({
      data: { organizationId: org.organizationId, alias: address, personalEmail: '', active: true },
    })
    const body = payload({
      email_id: `re_inbound_no_forward_${Date.now()}`,
      from: 'Round Trip <round-trip@example.com>',
      to: [address],
      subject: 'Adresse sans transfert',
    })
    const headers = signTestWebhook(org.webhookSecret, body)

    const response = await request(app)
      .post(`/api/inbound-mail/${org.webhookToken}`)
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(body)
    expect(response.status).toBe(200)

    let event = null
    for (let i = 0; i < 30 && event?.status !== 'completed'; i++) {
      event = await prisma.inboundEvent.findFirst({
        where: { organizationId: org.organizationId, provider: 'resend', externalId: headers['svix-id'] },
      })
      if (event?.status !== 'completed') await new Promise(resolve => setTimeout(resolve, 100))
    }

    expect(event?.status).toBe('completed')
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    const outboundCalls = fetchMock.mock.calls.filter(([input]) => input.toString() === 'https://api.resend.com/emails')
    expect(outboundCalls).toHaveLength(0)
    expect(
      await prisma.threadMessage.count({
        where: { organizationId: org.organizationId, direction: 'inbound', fromEmail: 'round-trip@example.com' },
      })
    ).toBe(1)
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

  it('never merges a Resend message into a personal-mailbox thread', async () => {
    const connection = await prisma.externalMailboxConnection.create({
      data: {
        organizationId: org.organizationId,
        userId: org.userId,
        provider: 'imap',
        email: `personal-${Date.now()}@example.com`,
        imapHost: 'imap.example.com',
        smtpHost: 'smtp.example.com',
        credentialEnc: 'irrelevant',
      },
    })
    const personalThread = await prisma.thread.create({
      data: {
        organizationId: org.organizationId,
        canal: 'contact',
        sujet: 'Fil personnel existant',
        externalFrom: 'Collision',
        externalEmail: 'personal-collision@example.com',
        assignedToId: org.userId,
        sourceId: connection.id,
        sourceType: connection.provider,
      },
    })
    const body = payload({
      email_id: `re_inbound_source_${Date.now()}`,
      from: 'Collision <personal-collision@example.com>',
      subject: 'Message Resend distinct',
    })
    const headers = signTestWebhook(org.webhookSecret, body)

    const response = await request(app)
      .post(`/api/inbound-mail/${org.webhookToken}`)
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(body)
    expect(response.status).toBe(200)

    let event = null
    for (let i = 0; i < 30 && event?.status !== 'completed'; i++) {
      event = await prisma.inboundEvent.findFirst({
        where: { organizationId: org.organizationId, provider: 'resend', externalId: headers['svix-id'] },
      })
      if (event?.status !== 'completed') await new Promise(resolve => setTimeout(resolve, 100))
    }

    expect(event?.status).toBe('completed')
    expect(await prisma.threadMessage.count({ where: { threadId: personalThread.id } })).toBe(0)
    const resendThread = await prisma.thread.findFirst({
      where: { organizationId: org.organizationId, externalEmail: 'personal-collision@example.com', sourceId: null },
    })
    expect(resendThread).not.toBeNull()
    expect(await prisma.threadMessage.count({ where: { threadId: resendThread!.id } })).toBe(1)
  })

  it('uses Resend In-Reply-To metadata to select the exact thread before the subject fallback', async () => {
    const exactThread = await prisma.thread.create({
      data: {
        organizationId: org.organizationId,
        canal: 'contact',
        sujet: 'Sujet initial',
        externalFrom: 'Reference Client',
        externalEmail: 'reference-client@example.com',
        messages: {
          create: {
            organizationId: org.organizationId,
            direction: 'outbound',
            fromName: 'Test User',
            fromEmail: 'contact@testco.example',
            body: '<p>Réponse initiale</p>',
            internetMessageId: '<resend-original@example.com>',
          },
        },
      },
    })
    await prisma.thread.create({
      data: {
        organizationId: org.organizationId,
        canal: 'contact',
        sujet: 'Sujet concurrent',
        externalFrom: 'Reference Client',
        externalEmail: 'reference-client@example.com',
      },
    })
    global.fetch = mockResendFetch({
      message_id: '<resend-reply@example.com>',
      headers: {
        'In-Reply-To': '<resend-original@example.com>',
        References: '<root@example.com> <resend-original@example.com>',
      },
    })
    const body = payload({
      email_id: `re_inbound_reference_${Date.now()}`,
      message_id: '<resend-reply@example.com>',
      from: 'Reference Client <reference-client@example.com>',
      subject: 'Sujet sans rapport avec le fallback',
    })
    const headers = signTestWebhook(org.webhookSecret, body)

    const response = await request(app)
      .post(`/api/inbound-mail/${org.webhookToken}`)
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(body)
    expect(response.status).toBe(200)

    let event = null
    for (let i = 0; i < 30 && event?.status !== 'completed'; i++) {
      event = await prisma.inboundEvent.findFirst({
        where: { organizationId: org.organizationId, provider: 'resend', externalId: headers['svix-id'] },
      })
      if (event?.status !== 'completed') await new Promise(resolve => setTimeout(resolve, 100))
    }

    expect(event?.status).toBe('completed')
    const messages = await prisma.threadMessage.findMany({ where: { threadId: exactThread.id }, orderBy: { sentAt: 'asc' } })
    expect(messages).toHaveLength(2)
    expect(messages[1].internetMessageId).toBe('<resend-reply@example.com>')
    expect(messages[1].inReplyTo).toBe('<resend-original@example.com>')
    expect(messages[1].references).toEqual(['<root@example.com>', '<resend-original@example.com>'])
  })

  it('records a conversation-token reply without echoing it back to the client', async () => {
    const thread = await prisma.thread.create({
      data: {
        organizationId: org.organizationId,
        canal: 'contact',
        sujet: 'Conversation sans écho',
        externalFrom: 'Client Echo',
        externalEmail: 'client-echo@example.com',
      },
    })
    const token = await prisma.mailReplyToken.create({
      data: {
        organizationId: org.organizationId,
        aliasFrom: 'contact@testco.example',
        externalTo: 'client-echo@example.com',
        subject: thread.sujet,
        purpose: 'conversation',
        threadId: thread.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    const body = payload({
      email_id: `re_inbound_no_echo_${Date.now()}`,
      from: 'Client Echo <client-echo@example.com>',
      to: [`reply+${token.token}@testco.example`],
      subject: 'Re: Conversation sans écho',
    })
    const headers = signTestWebhook(org.webhookSecret, body)

    const response = await request(app)
      .post(`/api/inbound-mail/${org.webhookToken}`)
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(body)
    expect(response.status).toBe(200)

    let event = null
    for (let i = 0; i < 30 && event?.status !== 'completed'; i++) {
      event = await prisma.inboundEvent.findFirst({
        where: { organizationId: org.organizationId, provider: 'resend', externalId: headers['svix-id'] },
      })
      if (event?.status !== 'completed') await new Promise(resolve => setTimeout(resolve, 100))
    }

    expect(event?.status).toBe('completed')
    expect(await prisma.threadMessage.count({ where: { threadId: thread.id, direction: 'inbound' } })).toBe(1)
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    const outboundCalls = fetchMock.mock.calls.filter(([input]) => input.toString() === 'https://api.resend.com/emails')
    expect(outboundCalls).toHaveLength(0)
  })

  it('keeps relaying replies received through a forward-bridge token', async () => {
    const thread = await prisma.thread.create({
      data: {
        organizationId: org.organizationId,
        canal: 'contact',
        sujet: 'Pont de transfert',
        externalFrom: 'Client Pont',
        externalEmail: 'client-bridge@example.com',
      },
    })
    const token = await prisma.mailReplyToken.create({
      data: {
        organizationId: org.organizationId,
        aliasFrom: 'contact@testco.example',
        externalTo: 'client-bridge@example.com',
        subject: thread.sujet,
        purpose: 'forward_bridge',
        threadId: thread.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    const body = payload({
      email_id: `re_inbound_bridge_${Date.now()}`,
      from: 'Collaborateur <collaborateur@example.com>',
      to: [`reply+${token.token}@testco.example`],
      subject: 'Re: Pont de transfert',
    })
    const headers = signTestWebhook(org.webhookSecret, body)

    const response = await request(app)
      .post(`/api/inbound-mail/${org.webhookToken}`)
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(body)
    expect(response.status).toBe(200)

    let event = null
    for (let i = 0; i < 30 && event?.status !== 'completed'; i++) {
      event = await prisma.inboundEvent.findFirst({
        where: { organizationId: org.organizationId, provider: 'resend', externalId: headers['svix-id'] },
      })
      if (event?.status !== 'completed') await new Promise(resolve => setTimeout(resolve, 100))
    }

    expect(event?.status).toBe('completed')
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    const outboundCalls = fetchMock.mock.calls.filter(([input]) => input.toString() === 'https://api.resend.com/emails')
    expect(outboundCalls).toHaveLength(1)
    const nextToken = await prisma.mailReplyToken.findFirst({
      where: { organizationId: org.organizationId, threadId: thread.id, id: { not: token.id } },
      orderBy: { createdAt: 'desc' },
    })
    expect(nextToken?.purpose).toBe('forward_bridge')
  })
})
