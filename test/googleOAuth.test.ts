import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildGoogleAuthUrl, exchangeCodeForTokens, refreshGoogleAccessToken, getGoogleUserEmail } from '../src/lib/googleOAuth'

describe('lib/googleOAuth', () => {
  describe('buildGoogleAuthUrl', () => {
    it('builds a well-formed authorization URL', () => {
      const url = new URL(buildGoogleAuthUrl('the-state-token'))
      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(url.searchParams.get('client_id')).toBe('test-google-client-id')
      expect(url.searchParams.get('scope')).toBe('https://mail.google.com/ openid email')
      expect(url.searchParams.get('access_type')).toBe('offline')
      expect(url.searchParams.get('prompt')).toBe('consent')
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('state')).toBe('the-state-token')
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3001/api/mailbox-connections/gmail/callback')
    })
  })

  describe('token exchange/refresh/userinfo — fetch mocked', () => {
    const originalFetch = global.fetch
    let calls: { url: string; init?: RequestInit }[] = []

    beforeEach(() => {
      calls = []
      global.fetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const url = input.toString()
        calls.push({ url, init })
        if (url.includes('oauth2.googleapis.com/token')) {
          const body = new URLSearchParams(init?.body as string)
          if (body.get('grant_type') === 'authorization_code') {
            return new Response(JSON.stringify({ access_token: 'access-1', refresh_token: 'refresh-1' }), { status: 200 })
          }
          if (body.get('grant_type') === 'refresh_token') {
            return new Response(JSON.stringify({ access_token: 'access-2' }), { status: 200 })
          }
        }
        if (url.includes('googleapis.com/oauth2/v3/userinfo')) {
          return new Response(JSON.stringify({ email: 'moi@gmail.com' }), { status: 200 })
        }
        return new Response('not found', { status: 404 })
      }) as unknown as typeof fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('exchangeCodeForTokens posts the authorization code and returns both tokens', async () => {
      const tokens = await exchangeCodeForTokens('auth-code-1')
      expect(tokens).toEqual({ refreshToken: 'refresh-1', accessToken: 'access-1' })
      expect(calls).toHaveLength(1)
      expect(calls[0].url).toBe('https://oauth2.googleapis.com/token')
      const body = new URLSearchParams(calls[0].init?.body as string)
      expect(body.get('grant_type')).toBe('authorization_code')
      expect(body.get('code')).toBe('auth-code-1')
      expect(body.get('redirect_uri')).toBe('http://localhost:3001/api/mailbox-connections/gmail/callback')
    })

    it('throws when Google does not return a refresh_token', async () => {
      global.fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: 'access-1' }), { status: 200 })) as unknown as typeof fetch
      await expect(exchangeCodeForTokens('auth-code-1')).rejects.toThrow(/refresh_token/)
    })

    it('throws when the token endpoint responds with an error status', async () => {
      global.fetch = vi.fn(async () => new Response('bad request', { status: 400 })) as unknown as typeof fetch
      await expect(exchangeCodeForTokens('auth-code-1')).rejects.toThrow(/400/)
    })

    it('refreshGoogleAccessToken posts the refresh_token grant and returns a fresh access token', async () => {
      const accessToken = await refreshGoogleAccessToken('refresh-1')
      expect(accessToken).toBe('access-2')
      const body = new URLSearchParams(calls[0].init?.body as string)
      expect(body.get('grant_type')).toBe('refresh_token')
      expect(body.get('refresh_token')).toBe('refresh-1')
    })

    it('getGoogleUserEmail sends the access token as a bearer header and returns the email', async () => {
      const email = await getGoogleUserEmail('access-1')
      expect(email).toBe('moi@gmail.com')
      expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1')
    })
  })
})
