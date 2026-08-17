import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app'

describe('split web frontends', () => {
  it.each(['http://localhost:5173', 'http://localhost:5174'])(
    'allows CORS requests from %s',
    async origin => {
      const response = await request(app).get('/health').set('Origin', origin)

      expect(response.status).toBe(200)
      expect(response.headers['access-control-allow-origin']).toBe(origin)
      expect(response.headers['access-control-allow-credentials']).toBe('true')
    },
  )

  it('does not allow an unknown web origin', async () => {
    const response = await request(app).get('/health').set('Origin', 'https://example.invalid')

    expect(response.status).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
