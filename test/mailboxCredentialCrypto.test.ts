import { describe, it, expect } from 'vitest'
import { encryptMailboxCredential, decryptMailboxCredential } from '../src/lib/mailboxCredentialCrypto'

describe('lib/mailboxCredentialCrypto', () => {
  it('round-trips a plaintext value', () => {
    const secret = 'an-imap-password-123'
    expect(decryptMailboxCredential(encryptMailboxCredential(secret))).toBe(secret)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const secret = 'an-imap-password-123'
    expect(encryptMailboxCredential(secret)).not.toBe(encryptMailboxCredential(secret))
  })

  it('rejects a malformed payload', () => {
    expect(() => decryptMailboxCredential('not-a-valid-payload')).toThrow()
  })
})
