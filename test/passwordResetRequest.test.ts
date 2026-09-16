import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import crypto from 'crypto'
import request from 'supertest'

const sentEmails = vi.hoisted(() => [] as Array<Record<string, unknown>>)

vi.mock('../src/lib/resendClient', () => ({
  buildResendClient: () => ({
    emails: {
      send: async (payload: Record<string, unknown>) => {
        sentEmails.push(payload)
        return { data: { id: 'reset-email-test' } }
      },
    },
  }),
}))

import app from '../src/app'
import config from '../src/config'
import prisma from '../src/lib/prisma'
import { cleanupOrg, seedOrg, type SeededOrg } from './helpers/seed'

describe('POST /api/auth/password-reset/request', () => {
  let org: SeededOrg
  let previousApiKey: string | undefined
  let previousFrom: string | undefined

  beforeAll(async () => {
    previousApiKey = config.systemResendApiKey
    previousFrom = config.systemEmailFrom
    config.systemResendApiKey = 're_system_test'
    config.systemEmailFrom = 'security@re-mail.example'
    org = await seedOrg('password-reset-request')
  })

  afterAll(async () => {
    config.systemResendApiKey = previousApiKey
    config.systemEmailFrom = previousFrom
    await cleanupOrg(org.organizationId)
  })

  it('emails a usable raw token while storing only its hash', async () => {
    const existing = await request(app).post('/api/auth/password-reset/request').send({ username: org.username })
    expect(existing.status).toBe(202)
    expect(sentEmails).toHaveLength(1)

    const html = String(sentEmails[0].html)
    const match = /reset-password\?token=([^"&]+)/.exec(html)
    expect(match).not.toBeNull()
    const rawToken = decodeURIComponent(match![1])
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex')

    const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash } })
    expect(stored).not.toBeNull()
    expect(stored?.tokenHash).not.toBe(rawToken)

    const confirmed = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: rawToken, newPassword: 'emailed-password-123' })
    expect(confirmed.status).toBe(200)

    const unknown = await request(app)
      .post('/api/auth/password-reset/request')
      .send({ username: `unknown-${Date.now()}` })
    expect(unknown.status).toBe(202)
    expect(unknown.body).toEqual(existing.body)
    expect(sentEmails).toHaveLength(1)
  })
})
