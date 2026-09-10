import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import prisma from '../src/lib/prisma'
import { findCorrelatedThread, normalizeThreadSubject, parseMessageIdList } from '../src/helpers/threadCorrelation'
import { forOrg } from '../src/middleware/scopedPrisma'
import { cleanupOrg, seedOrg, SeededOrg } from './helpers/seed'

describe('thread correlation', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('thread-correlation')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('normalizes reply prefixes and bounded Message-ID lists', () => {
    expect(normalizeThreadSubject(' Re: Fwd:  Demande   de devis ')).toBe('demande de devis')
    expect(parseMessageIdList(' <ROOT@Example.com> <next@example.com> <ROOT@example.com> ')).toEqual([
      '<ROOT@example.com>',
      '<next@example.com>',
    ])
  })

  it('uses References when In-Reply-To is absent, even when the subject changed', async () => {
    const referencedThread = await prisma.thread.create({
      data: {
        organizationId: org.organizationId,
        canal: 'contact',
        sujet: 'Sujet original',
        externalFrom: 'Client',
        externalEmail: 'client@example.com',
        messages: {
          create: {
            organizationId: org.organizationId,
            direction: 'inbound',
            fromName: 'Client',
            fromEmail: 'client@example.com',
            body: '<p>Original</p>',
            internetMessageId: '<referenced@example.com>',
          },
        },
      },
    })
    await prisma.thread.create({
      data: {
        organizationId: org.organizationId,
        canal: 'contact',
        sujet: 'Nouveau sujet',
        externalFrom: 'Client',
        externalEmail: 'client@example.com',
      },
    })

    const match = await findCorrelatedThread(forOrg(org.organizationId), {
      canal: 'contact',
      sourceId: null,
      externalEmail: 'client@example.com',
      subject: 'Sujet totalement différent',
      references: ['<older@example.com>', '<referenced@example.com>'],
    })

    expect(match?.id).toBe(referencedThread.id)
  })
})
