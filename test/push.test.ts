import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendPush } from '../src/lib/push'

describe('lib/push', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('does nothing when there are no targets (no crash, no request)', async () => {
    await sendPush([], { title: 't', body: 'b' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls the Expo push endpoint with the right tokens', async () => {
    await sendPush([{ token: 'ExponentPushToken[aaa]' }, { token: 'ExponentPushToken[bbb]' }], {
      title: 'Nouveau message',
      body: 'Bonjour',
      data: { threadId: 't1' },
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://exp.host/--/api/v2/push/send')
    const sent = JSON.parse((init as RequestInit).body as string)
    expect(sent).toHaveLength(2)
    expect(sent[0]).toMatchObject({ to: 'ExponentPushToken[aaa]', title: 'Nouveau message', body: 'Bonjour', data: { threadId: 't1' } })
  })

  it('does not throw when the Expo endpoint fails', async () => {
    global.fetch = vi.fn(async () => new Response('error', { status: 500 })) as unknown as typeof fetch
    await expect(sendPush([{ token: 'x' }], { title: 't', body: 'b' })).resolves.toBeUndefined()
  })

  it('does not throw when fetch itself rejects', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network down') }) as unknown as typeof fetch
    await expect(sendPush([{ token: 'x' }], { title: 't', body: 'b' })).resolves.toBeUndefined()
  })
})
