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

  it('rejects malformed or oversized input before creating a thread or calling Resend', async () => {
    const initialThreadCount = await prisma.thread.count({ where: { organizationId: org.organizationId } })
    const invalidPayloads = [
      { to: 'not-an-email', subject: 'Test', message: 'Bonjour' },
      { to: 'client@example.com', subject: 'Test', message: '   ' },
      { to: 'client@example.com', subject: 'x'.repeat(999), message: 'Bonjour' },
      { to: 'client@example.com', subject: 'Test', message: 'x'.repeat(100_001) },
      { to: 'client@example.com', subject: 'Test', message: 'Bonjour', threadId: { forged: true } },
    ]

    for (const payload of invalidPayloads) {
      const response = await request(app).post('/api/emails/reply').set('Authorization', `Bearer ${org.token}`).send(payload)
      expect(response.status).toBe(400)
    }

    expect(sendCalls).toHaveLength(0)
    expect(await prisma.thread.count({ where: { organizationId: org.organizationId } })).toBe(initialThreadCount)
  })

  it('returns 413 instead of 500 when the HTTP JSON limit is exceeded', async () => {
    const response = await request(app)
      .post('/api/emails/reply')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ to: 'client@example.com', subject: 'Test', message: 'x'.repeat(110_000) })

    expect(response.status).toBe(413)
    expect(sendCalls).toHaveLength(0)
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
    const token = await prisma.mailReplyToken.findFirst({ where: { threadId: res.body.threadId } })
    expect(token?.purpose).toBe('conversation')
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

  it('rejects a source message belonging to another thread before creating side effects', async () => {
    const targetThread = await prisma.thread.create({
      data: {
        organizationId: org.organizationId,
        canal: 'contact',
        sujet: 'Fil cible',
        externalFrom: 'Client cible',
        externalEmail: 'target@example.com',
        toEmail: 'owner@testco.example',
        origin: 'inbound',
      },
    })
    const otherThread = await prisma.thread.create({
      data: {
        organizationId: org.organizationId,
        canal: 'contact',
        sujet: 'Autre fil',
        externalFrom: 'Autre client',
        externalEmail: 'other@example.com',
        origin: 'inbound',
      },
    })
    const otherMessage = await prisma.threadMessage.create({
      data: {
        organizationId: org.organizationId,
        threadId: otherThread.id,
        direction: 'inbound',
        fromName: 'Autre client',
        fromEmail: 'other@example.com',
        body: '<p>Message hors fil</p>',
      },
    })

    const response = await request(app)
      .post('/api/emails/reply')
      .set('Authorization', `Bearer ${org.token}`)
      .send({
        to: 'third-party@example.com',
        subject: 'Tentative de transfert',
        message: 'Pour information.',
        threadId: targetThread.id,
        sourceMessageId: otherMessage.id,
        mode: 'forward',
      })

    expect(response.status).toBe(404)
    expect(sendCalls).toHaveLength(0)
    expect(await prisma.mailReplyToken.count({ where: { threadId: targetThread.id } })).toBe(0)
    expect(await prisma.threadMessage.count({ where: { threadId: targetThread.id, direction: 'outbound' } })).toBe(0)
    expect(await prisma.threadActivity.count({ where: { threadId: targetThread.id, type: 'forwarded' } })).toBe(0)
  })

  it('rejects a source message belonging to another tenant before creating side effects', async () => {
    const foreignOrg = await seedOrg('reply-foreign-source')
    try {
      const targetThread = await prisma.thread.create({
        data: {
          organizationId: org.organizationId,
          canal: 'contact',
          sujet: 'Fil du tenant courant',
          externalFrom: 'Client courant',
          externalEmail: 'current@example.com',
          toEmail: 'owner@testco.example',
          origin: 'inbound',
        },
      })
      const foreignThread = await prisma.thread.create({
        data: {
          organizationId: foreignOrg.organizationId,
          canal: 'contact',
          sujet: 'Fil étranger',
          externalFrom: 'Client étranger',
          externalEmail: 'foreign@example.com',
          origin: 'inbound',
        },
      })
      const foreignMessage = await prisma.threadMessage.create({
        data: {
          organizationId: foreignOrg.organizationId,
          threadId: foreignThread.id,
          direction: 'inbound',
          fromName: 'Client étranger',
          fromEmail: 'foreign@example.com',
          body: '<p>Message confidentiel</p>',
        },
      })

      const response = await request(app)
        .post('/api/emails/reply')
        .set('Authorization', `Bearer ${org.token}`)
        .send({
          to: 'third-party@example.com',
          subject: 'Tentative inter-tenant',
          message: 'Pour information.',
          threadId: targetThread.id,
          sourceMessageId: foreignMessage.id,
          mode: 'forward',
        })

      expect(response.status).toBe(404)
      expect(sendCalls).toHaveLength(0)
      expect(await prisma.mailReplyToken.count({ where: { threadId: targetThread.id } })).toBe(0)
      expect(await prisma.threadMessage.count({ where: { threadId: targetThread.id, direction: 'outbound' } })).toBe(0)
      expect(await prisma.threadActivity.count({ where: { threadId: targetThread.id, type: 'forwarded' } })).toBe(0)
    } finally {
      await cleanupOrg(foreignOrg.organizationId)
    }
  })
})
