import { describe, it, expect } from 'vitest'
import type { Request } from 'express'
import { verifyResendWebhook } from '../src/helpers/webhookSignature'
import { signTestWebhook } from './helpers/webhookSigner'

const SECRET = 'whsec_dGVzdHNlY3JldGZvcnRlc3RzMTIzNDU2Nzg5MA=='

function fakeRequest(rawBody: string, headers: Record<string, string>): Request {
  return {
    rawBody: Buffer.from(rawBody),
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request
}

describe('helpers/webhookSignature', () => {
  it('accepts a correctly signed payload', () => {
    const rawBody = JSON.stringify({ type: 'email.received', data: { email_id: 're_1' } })
    const headers = signTestWebhook(SECRET, rawBody)
    const req = fakeRequest(rawBody, headers)
    expect(verifyResendWebhook(req, SECRET)).toBe(true)
  })

  it('rejects a payload signed with a different organization\'s secret', () => {
    const rawBody = JSON.stringify({ type: 'email.received', data: { email_id: 're_1' } })
    const headers = signTestWebhook('whsec_d3JvbmdzZWNyZXRmb3J0ZXN0czEyMzQ1Njc4OTA=', rawBody)
    const req = fakeRequest(rawBody, headers)
    expect(verifyResendWebhook(req, SECRET)).toBe(false)
  })

  it('rejects a tampered body (signature no longer matches)', () => {
    const rawBody = JSON.stringify({ type: 'email.received', data: { email_id: 're_1' } })
    const headers = signTestWebhook(SECRET, rawBody)
    const tamperedReq = fakeRequest(JSON.stringify({ type: 'email.received', data: { email_id: 're_HACKED' } }), headers)
    expect(verifyResendWebhook(tamperedReq, SECRET)).toBe(false)
  })

  it('rejects a replayed old timestamp', () => {
    const rawBody = JSON.stringify({ type: 'email.received', data: { email_id: 're_1' } })
    const oldTimestamp = Math.floor(Date.now() / 1000) - 10 * 60 // 10 minutes ago
    const headers = signTestWebhook(SECRET, rawBody, oldTimestamp)
    const req = fakeRequest(rawBody, headers)
    expect(verifyResendWebhook(req, SECRET)).toBe(false)
  })

  it('rejects when headers are missing', () => {
    const req = fakeRequest('{}', {})
    expect(verifyResendWebhook(req, SECRET)).toBe(false)
  })
})
