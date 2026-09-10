import type { PrismaClient, Thread } from '@prisma/client'

const MAX_MESSAGE_IDS = 50
const MAX_MESSAGE_ID_LENGTH = 998

export function normalizeMessageId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const bracketed = trimmed.match(/^<([^<>@]+)@([^<>]+)>$/)
  const normalized = bracketed ? `<${bracketed[1]}@${bracketed[2].toLowerCase()}>` : trimmed
  if (!normalized || normalized.length > MAX_MESSAGE_ID_LENGTH) return null
  return normalized
}

export function parseMessageIdList(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : value == null ? [] : [value]
  const result: string[] = []

  for (const raw of rawValues) {
    if (typeof raw !== 'string') continue
    const parts = raw.match(/<[^<>]+>/g) ?? raw.split(/\s+/)
    for (const part of parts) {
      const normalized = normalizeMessageId(part)
      if (normalized && !result.includes(normalized)) result.push(normalized)
      if (result.length >= MAX_MESSAGE_IDS) return result
    }
  }

  return result
}

export function normalizeThreadSubject(value: unknown): string {
  if (typeof value !== 'string') return ''
  const normalized = value
    .normalize('NFKC')
    .replace(/^\s*(?:(?:re|fw|fwd|tr)\s*:\s*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return normalized === '(sans sujet)' ? '' : normalized
}

export function getEmailHeader(headers: unknown, name: string): unknown {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return undefined
  const entry = Object.entries(headers as Record<string, unknown>).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return entry?.[1]
}

interface FindCorrelatedThreadInput {
  canal: string
  sourceId: string | null
  externalEmail: string
  subject: string
  inReplyTo?: string | null
  references?: string[]
}

export async function findCorrelatedThread(
  db: PrismaClient,
  input: FindCorrelatedThreadInput
): Promise<Thread | null> {
  const referenceIds = [input.inReplyTo, ...(input.references ?? []).slice().reverse()]
    .map(normalizeMessageId)
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, MAX_MESSAGE_IDS)

  if (referenceIds.length) {
    const matchingMessages = await db.threadMessage.findMany({
      where: {
        internetMessageId: { in: referenceIds },
        thread: {
          canal: input.canal,
          sourceId: input.sourceId,
          status: { not: 'resolu' },
        },
      },
      orderBy: { sentAt: 'desc' },
      select: { internetMessageId: true, thread: true },
    })
    for (const referenceId of referenceIds) {
      const match = matchingMessages.find(message => message.internetMessageId === referenceId)
      if (match) return match.thread
    }
  }

  const normalizedSubject = normalizeThreadSubject(input.subject)
  if (!normalizedSubject) return null

  // Compatibilité avec les fils historiques dépourvus d'en-têtes : le fallback
  // exige désormais même expéditeur, même boîte ET même sujet normalisé.
  const candidates = await db.thread.findMany({
    where: {
      externalEmail: input.externalEmail,
      canal: input.canal,
      sourceId: input.sourceId,
      status: { not: 'resolu' },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return candidates.find(thread => normalizeThreadSubject(thread.sujet) === normalizedSubject) ?? null
}
