import { describe, it, expect } from 'vitest'
import { encryptInviteFile, decryptInviteFile } from '../src/lib/inviteFileCrypto'

describe('lib/inviteFileCrypto', () => {
  it('round-trips a plaintext payload', () => {
    const payload = JSON.stringify({ v: 1, token: 'abc123' })
    expect(decryptInviteFile(encryptInviteFile(payload))).toBe(payload)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const payload = JSON.stringify({ v: 1, token: 'abc123' })
    expect(encryptInviteFile(payload)).not.toBe(encryptInviteFile(payload))
  })

  it('rejects a tampered ciphertext (GCM auth tag failure)', () => {
    const enc = encryptInviteFile(JSON.stringify({ v: 1, token: 'abc123' }))
    const [iv, tag, data] = enc.split('.')
    const tamperedData = Buffer.from(data, 'base64')
    tamperedData[0] ^= 0xff
    const tampered = [iv, tag, tamperedData.toString('base64')].join('.')
    expect(() => decryptInviteFile(tampered)).toThrow()
  })

  it('rejects a malformed payload', () => {
    expect(() => decryptInviteFile('not-a-valid-payload')).toThrow()
  })

  it('is not decryptable with the master encryption key (separate trust domain)', async () => {
    const { decrypt } = await import('../src/lib/crypto')
    const enc = encryptInviteFile(JSON.stringify({ v: 1, token: 'abc123' }))
    expect(() => decrypt(enc)).toThrow()
  })
})
