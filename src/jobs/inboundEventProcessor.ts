import type { Organization, Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export type InboundEventHandler = (
  organization: Organization,
  payload: unknown,
  inboundEventId: string
) => Promise<void>

const PROVIDER_RESEND = 'resend'
const PROCESS_INTERVAL_MS = 5_000
const LOCK_TIMEOUT_MS = 5 * 60_000
const MAX_ATTEMPTS = 8

let intervalHandle: NodeJS.Timeout | null = null
let configuredHandler: InboundEventHandler | null = null

export async function enqueueResendInboundEvent(
  organizationId: string,
  externalId: string,
  payload: Prisma.InputJsonValue
) {
  return enqueueInboundEvent(organizationId, PROVIDER_RESEND, externalId, payload)
}

export async function enqueueInboundEvent(
  organizationId: string,
  provider: string,
  externalId: string,
  payload: Prisma.InputJsonValue
) {
  try {
    return await prisma.inboundEvent.create({
      data: {
        organizationId,
        provider,
        externalId,
        payload,
      },
    })
  } catch (error) {
    // Prisma peut implémenter un upsert par SELECT puis INSERT : deux livraisons
    // réellement simultanées verraient alors toutes deux « absent », et l'une
    // recevrait P2002. La contrainte PostgreSQL reste l'arbitre ; le perdant relit
    // simplement la ligne créée par l'autre requête.
    if ((error as { code?: string }).code !== 'P2002') throw error
    const existing = await prisma.inboundEvent.findUnique({
      where: {
        organizationId_provider_externalId: {
          organizationId,
          provider,
          externalId,
        },
      },
    })
    if (!existing) throw error
    return existing
  }
}

function retryDelayMs(attemptCount: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.max(0, attemptCount - 1))
}

// Revendication atomique : même si le webhook, le cycle de reprise ou une autre
// instance appellent cette fonction en même temps, un seul updateMany peut passer
// l'événement dans l'état processing.
export async function processInboundEvent(eventId: string, handler: InboundEventHandler): Promise<boolean> {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS)
  const claimed = await prisma.inboundEvent.updateMany({
    where: {
      id: eventId,
      attemptCount: { lt: MAX_ATTEMPTS },
      OR: [
        {
          status: { in: ['pending', 'failed'] },
          AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }],
        },
        { status: 'processing', lockedAt: { lte: staleBefore } },
      ],
    },
    data: {
      status: 'processing',
      lockedAt: now,
      nextAttemptAt: null,
      lastError: null,
      attemptCount: { increment: 1 },
    },
  })

  if (claimed.count === 0) return false

  const event = await prisma.inboundEvent.findUnique({
    where: { id: eventId },
    include: { organization: true },
  })
  if (!event) return false

  try {
    await handler(event.organization, event.payload, event.id)
    await prisma.inboundEvent.update({
      where: { id: event.id },
      data: {
        status: 'completed',
        processedAt: new Date(),
        lockedAt: null,
        nextAttemptAt: null,
        lastError: null,
      },
    })
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.inboundEvent.update({
      where: { id: event.id },
      data: {
        status: 'failed',
        lockedAt: null,
        nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attemptCount)),
        lastError: message.slice(0, 1_000),
      },
    })
    console.error(`[INBOUND-EVENT] ${event.id} échec tentative ${event.attemptCount}: ${message}`)
    return false
  }
}

export async function processPendingInboundEvents(provider: string, handler: InboundEventHandler): Promise<void> {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS)
  const events = await prisma.inboundEvent.findMany({
    where: {
      provider,
      attemptCount: { lt: MAX_ATTEMPTS },
      OR: [
        {
          status: { in: ['pending', 'failed'] },
          AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }],
        },
        { status: 'processing', lockedAt: { lte: staleBefore } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true },
  })

  for (const event of events) await processInboundEvent(event.id, handler)
}

export function startInboundEventProcessing(handler: InboundEventHandler): void {
  if (intervalHandle) return
  configuredHandler = handler
  void processPendingInboundEvents(PROVIDER_RESEND, handler).catch(error => {
    console.error('[INBOUND-EVENT] reprise initiale:', error)
  })
  intervalHandle = setInterval(() => {
    if (!configuredHandler) return
    void processPendingInboundEvents(PROVIDER_RESEND, configuredHandler).catch(error => {
      console.error('[INBOUND-EVENT] cycle de reprise:', error)
    })
  }, PROCESS_INTERVAL_MS)
}

export function stopInboundEventProcessing(): void {
  if (intervalHandle) clearInterval(intervalHandle)
  intervalHandle = null
  configuredHandler = null
}
