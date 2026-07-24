import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

describe('POST /api/emails/reply — cc/bcc/forward', () => {
  let org: SeededOrg
  const originalFetch = global.fetch
  let sendCalls: { url: string; body: Record<string, unknown> }[] = []

  beforeAll(async () => {
    org = await seedOrg('reply-test')
    await prisma.user.update({ where: { id: org.userId }, data: { proEmail: 'owner@testco.example' } })
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  beforeEach(() => {
    sendCalls = []
    global.fetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = input.toString()
      if (url.includes('api.resend.com/emails')) {
        sendCalls.push({ url, body: JSON.parse((init?.body as string) || '{}') })
        return new Response(JSON.stringify({ id: 're_sent_test' }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('sends a new email with cc/bcc and persists them on the ThreadMessage', async () => {
    const res = await request(app)
      .post('/api/emails/reply')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        to: 'client@example.com',
        cc: 'manager@example.com, not-an-email',
        bcc: 'archive@example.com',
        subject: 'Nouveau contact',
        message: 'Bonjour,',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0].body.cc).toEqual(['manager@example.com'])
    expect(sendCalls[0].body.bcc).toEqual(['archive@example.com'])

    const msg = await prisma.threadMessage.findFirst({ where: { threadId: res.body.threadId } })
    expect(msg?.ccEmails).toBe('manager@example.com')
    expect(msg?.bccEmails).toBe('archive@example.com')
  })

  it('forwards a message reusing its stored attachments, without re-fetching from Resend', async () => {
    const thread = await prisma.thread.create({
      data: {
        organizationId: org.organizationId,
        canal: 'contact',
        sujet: 'Fil à transférer',
        externalFrom: 'Client X',
        externalEmail: 'x@example.com',
        toEmail: 'owner@testco.example',
        origin: 'inbound',
      },
    })
    const sourceMessage = await prisma.threadMessage.create({
      data: {
        organizationId: org.organizationId,
        threadId: thread.id,
        direction: 'inbound',
        fromName: 'Client X',
        fromEmail: 'x@example.com',
        body: '<p>Corps original</p>',
        attachments: { create: { filename: 'devis.pdf', contentType: 'application/pdf', size: 1234, url: 'https://cdn.example.com/devis.pdf' } },
      },
    })

    const res = await request(app)
      .post('/api/emails/reply')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        to: 'third-party@example.com',
        subject: 'Fil à transférer',
        message: 'Pour information.',
        threadId: thread.id,
        sourceMessageId: sourceMessage.id,
        mode: 'forward',
      })

    expect(res.status).toBe(200)
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0].body.subject).toMatch(/^Fwd:/)
    expect(sendCalls[0].body.html).toContain('Corps original')
    expect(sendCalls[0].body.attachments).toEqual([{ path: 'https://cdn.example.com/devis.pdf', filename: 'devis.pdf' }])

    const activity = await prisma.threadActivity.findFirst({ where: { threadId: thread.id, type: 'forwarded' } })
    expect(activity).not.toBeNull()
  })
})
