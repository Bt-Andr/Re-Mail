import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../src/lib/crypto'

describe('lib/crypto', () => {
  it('round-trips a plaintext value', () => {
    const secret = 're_test_1234567890abcdef'
    expect(decrypt(encrypt(secret))).toBe(secret)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const secret = 'whsec_abc'
    expect(encrypt(secret)).not.toBe(encrypt(secret))
  })

  it('rejects a tampered ciphertext (GCM auth tag failure)', () => {
    const enc = encrypt('re_test_1234567890abcdef')
    const [iv, tag, data] = enc.split('.')
    const tamperedData = Buffer.from(data, 'base64')
    tamperedData[0] ^= 0xff
    const tampered = [iv, tag, tamperedData.toString('base64')].join('.')
    expect(() => decrypt(tampered)).toThrow()
  })

  it('rejects a malformed payload', () => {
    expect(() => decrypt('not-a-valid-payload')).toThrow()
  })
})
