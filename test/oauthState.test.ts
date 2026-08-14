import { describe, it, expect } from 'vitest'
import { signOAuthState, verifyOAuthState } from '../src/lib/oauthState'

describe('lib/oauthState', () => {
  it('round-trips a state payload', () => {
    const state = { userId: 'user_1', organizationId: 'org_1', returnTo: 'http://localhost:5173/mailboxes' }
    const decoded = verifyOAuthState(signOAuthState(state))
    expect(decoded.userId).toBe(state.userId)
    expect(decoded.organizationId).toBe(state.organizationId)
    expect(decoded.returnTo).toBe(state.returnTo)
  })

  it('rejects a tampered token', () => {
    const token = signOAuthState({ userId: 'user_1', organizationId: 'org_1', returnTo: 're-mail://mailboxes' })
    const tampered = token.slice(0, -2) + (token.at(-2) === 'a' ? 'b' : 'a') + token.at(-1)
    expect(() => verifyOAuthState(tampered)).toThrow()
  })

  it('rejects a malformed token', () => {
    expect(() => verifyOAuthState('not-a-jwt')).toThrow()
  })
})
