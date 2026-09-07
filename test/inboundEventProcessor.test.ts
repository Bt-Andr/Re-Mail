import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '../src/lib/prisma'
import {
  enqueueResendInboundEvent,
  processInboundEvent,
  processPendingInboundEvents,
} from '../src/jobs/inboundEventProcessor'
import { cleanupOrg, seedOrg, SeededOrg } from './helpers/seed'

describe('durable inbound event processor', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('inbound-event')
  })

  beforeEach(async () => {
    await prisma.inboundEvent.deleteMany({ where: { organizationId: org.organizationId } })
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('upserts the same provider event into one durable row', async () => {
    const externalId = `evt-upsert-${Date.now()}`
    const first = await enqueueResendInboundEvent(org.organizationId, externalId, { type: 'email.received' })
    const duplicate = await enqueueResendInboundEvent(org.organizationId, externalId, { type: 'email.received' })

    expect(duplicate.id).toBe(first.id)
    expect(
      await prisma.inboundEvent.count({
        where: { organizationId: org.organizationId, provider: 'resend', externalId },
      })
    ).toBe(1)
  })

  it('atomically lets only one concurrent worker process an event', async () => {
    const event = await enqueueResendInboundEvent(
      org.organizationId,
      `evt-concurrent-${Date.now()}`,
      { type: 'email.received' }
    )
    const handler = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    const results = await Promise.all([
      processInboundEvent(event.id, handler),
      processInboundEvent(event.id, handler),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
    expect(handler).toHaveBeenCalledTimes(1)
    const stored = await prisma.inboundEvent.findUnique({ where: { id: event.id } })
    expect(stored?.status).toBe('completed')
    expect(stored?.attemptCount).toBe(1)
    expect(stored?.processedAt).not.toBeNull()
  })

  it('records a failed attempt and can resume it later', async () => {
    const event = await enqueueResendInboundEvent(
      org.organizationId,
      `evt-retry-${Date.now()}`,
      { type: 'email.received' }
    )
    const failingHandler = vi.fn(async () => {
      throw new Error('temporary provider failure')
    })

    expect(await processInboundEvent(event.id, failingHandler)).toBe(false)
    let stored = await prisma.inboundEvent.findUnique({ where: { id: event.id } })
    expect(stored?.status).toBe('failed')
    expect(stored?.attemptCount).toBe(1)
    expect(stored?.lastError).toBe('temporary provider failure')
    expect(stored?.nextAttemptAt).not.toBeNull()

    await prisma.inboundEvent.update({
      where: { id: event.id },
      data: { nextAttemptAt: new Date(Date.now() - 1_000) },
    })
    const successfulHandler = vi.fn(async () => {})
    expect(await processInboundEvent(event.id, successfulHandler)).toBe(true)

    stored = await prisma.inboundEvent.findUnique({ where: { id: event.id } })
    expect(stored?.status).toBe('completed')
    expect(stored?.attemptCount).toBe(2)
    expect(stored?.lastError).toBeNull()
  })

  it('recovers an event that was persisted but not started before a restart', async () => {
    const event = await enqueueResendInboundEvent(
      org.organizationId,
      `evt-pending-${Date.now()}`,
      { type: 'email.received' }
    )
    const handler = vi.fn(async () => {})

    await processPendingInboundEvents('resend', handler)

    expect(handler).toHaveBeenCalledTimes(1)
    const stored = await prisma.inboundEvent.findUnique({ where: { id: event.id } })
    expect(stored?.status).toBe('completed')
    expect(stored?.attemptCount).toBe(1)
  })

  it('reclaims a processing event whose worker lock expired', async () => {
    const event = await enqueueResendInboundEvent(
      org.organizationId,
      `evt-stale-${Date.now()}`,
      { type: 'email.received' }
    )
    await prisma.inboundEvent.update({
      where: { id: event.id },
      data: {
        status: 'processing',
        lockedAt: new Date(Date.now() - 10 * 60_000),
      },
    })
    const handler = vi.fn(async () => {})

    expect(await processInboundEvent(event.id, handler)).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
    const stored = await prisma.inboundEvent.findUnique({ where: { id: event.id } })
    expect(stored?.status).toBe('completed')
    expect(stored?.attemptCount).toBe(1)
  })
})
