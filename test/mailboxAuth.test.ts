import { describe, it, expect, vi } from 'vitest'

const { mockRefreshGoogleAccessToken } = vi.hoisted(() => ({ mockRefreshGoogleAccessToken: vi.fn() }))
vi.mock('../src/lib/googleOAuth', () => ({
  refreshGoogleAccessToken: mockRefreshGoogleAccessToken,
}))

import { getMailboxAuth } from '../src/lib/mailboxAuth'
import { encryptMailboxCredential } from '../src/lib/mailboxCredentialCrypto'
import type { ExternalMailboxConnection } from '@prisma/client'

function baseConnection(overrides: Partial<ExternalMailboxConnection>): ExternalMailboxConnection {
  return {
    id: 'conn_1',
    organizationId: 'org_1',
    userId: 'user_1',
    provider: 'imap',
    email: 'moi@example.com',
    imapHost: 'imap.example.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.example.com',
    smtpPort: 465,
    smtpSecure: true,
    credentialEnc: encryptMailboxCredential('the-password'),
    status: 'connected',
    lastError: null,
    lastPolledAt: null,
    lastSeenUid: 0,
    uidValidity: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ExternalMailboxConnection
}

describe('lib/mailboxAuth', () => {
  it('returns a decrypted password for a generic imap provider', async () => {
    const connection = baseConnection({})
    const auth = await getMailboxAuth(connection)
    expect(auth).toEqual({ user: 'moi@example.com', pass: 'the-password' })
    expect(mockRefreshGoogleAccessToken).not.toHaveBeenCalled()
  })

  it('refreshes a Google access token for a gmail provider', async () => {
    mockRefreshGoogleAccessToken.mockResolvedValueOnce('fresh-access-token')
    const connection = baseConnection({ provider: 'gmail', email: 'moi@gmail.com', credentialEnc: encryptMailboxCredential('the-refresh-token') })
    const auth = await getMailboxAuth(connection)
    expect(auth).toEqual({ user: 'moi@gmail.com', accessToken: 'fresh-access-token' })
    expect(mockRefreshGoogleAccessToken).toHaveBeenCalledWith('the-refresh-token')
  })
})
