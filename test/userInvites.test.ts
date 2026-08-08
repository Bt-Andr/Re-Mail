import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

// La création d'invitation envoie désormais un email (routes/userInvites.ts
// ::sendInviteEmail) — sans ce stub, chaque createInvite() de ce fichier ferait
// un vrai appel réseau vers api.resend.com avec une fausse clé (échec silencieux
// mais lent et non déterministe). Même pattern que mailReply.test.ts.
const originalFetch = global.fetch
let resendSendCalls: { url: string; body: Record<string, unknown> }[] = []

beforeEach(() => {
  resendSendCalls = []
  global.fetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = input.toString()
    if (url.includes('api.resend.com/emails')) {
      resendSendCalls.push({ url, body: JSON.parse((init?.body as string) || '{}') })
      return new Response(JSON.stringify({ id: 're_sent_test' }), { status: 200 })
    }
    return new Response('not found', { status: 404 })
  }) as unknown as typeof fetch
})

afterEach(() => {
  global.fetch = originalFetch
})

async function createInvite(org: SeededOrg, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/user-invites')
    .set('Authorization', `Bearer ${org.token}`)
    .send({ username: `newuser-${Date.now()}-${Math.random().toString(36).slice(2)}`, email: `newuser-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`, nom: 'Nouvel Utilisateur', ...overrides })
  return res
}

async function downloadFile(org: SeededOrg, inviteId: string): Promise<Buffer> {
  const res = await request(app).get(`/api/user-invites/${inviteId}/file`).set('Authorization', `Bearer ${org.token}`)
  expect(res.status).toBe(200)
  return res.body as Buffer
}

async function generateCode(org: SeededOrg, inviteId: string): Promise<string> {
  const res = await request(app).post(`/api/user-invites/${inviteId}/activation-code`).set('Authorization', `Bearer ${org.token}`)
  expect(res.status).toBe(200)
  return res.body.code as string
}

describe('User invite activation flow', () => {
  let org: SeededOrg
  let orgB: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('invite-test')
    orgB = await seedOrg('invite-test-b')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
    await cleanupOrg(orgB.organizationId)
  })

  it('completes the full happy path: create -> file -> code -> resolve -> verify -> activate', async () => {
    const created = await createInvite(org)
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('PENDING')
    // L'org de test a resendApiKeyEnc + emailContact (voir helpers/seed.ts) : l'email
    // d'invitation doit partir, et jamais exposer le fileToken au client.
    expect(created.body.emailSent).toBe(true)
    expect(created.body.fileToken).toBeUndefined()
    expect(resendSendCalls).toHaveLength(1)
    expect(resendSendCalls[0].body.to).toBe(created.body.email)
    expect(String(resendSendCalls[0].body.html)).toContain('/activate?token=')

    const fileBytes = await downloadFile(org, created.body.id)
    const code = await generateCode(org, created.body.id)

    const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', fileBytes, 'activation.jep')
    expect(resolved.status).toBe(200)
    expect(resolved.body.organizationName).toBeTruthy()

    const verified = await request(app)
      .post('/api/public/user-invites/verify-code')
      .send({ fileToken: resolved.body.fileToken, code })
    expect(verified.status).toBe(200)
    expect(verified.body.activationToken).toBeTruthy()

    const activated = await request(app)
      .post('/api/public/user-invites/activate')
      .send({ fileToken: resolved.body.fileToken, activationToken: verified.body.activationToken, password: 'a-strong-password' })
    expect(activated.status).toBe(201)
    expect(activated.body.token).toBeTruthy()
    expect(activated.body.user.username).toBe(created.body.username)
    expect(activated.body.user.password).toBeUndefined()

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${activated.body.token}`)
    expect(me.status).toBe(200)
    expect(me.body.user.username).toBe(created.body.username)
  })

  it('decouples the file from the code: re-downloading the file does not change fileToken or invalidate a code', async () => {
    const created = await createInvite(org)
    const code = await generateCode(org, created.body.id)

    // AES-GCM utilise un IV aléatoire à chaque chiffrement : les octets diffèrent
    // à chaque téléchargement (propriété voulue), mais ils doivent déchiffrer vers
    // le même fileToken — c'est ça, la vraie garantie de découplage à vérifier.
    const firstFile = await downloadFile(org, created.body.id)
    const secondFile = await downloadFile(org, created.body.id)
    expect(firstFile.equals(secondFile)).toBe(false)

    const resolvedFirst = await request(app).post('/api/public/user-invites/resolve').attach('file', firstFile, 'activation.jep')
    const resolvedSecond = await request(app).post('/api/public/user-invites/resolve').attach('file', secondFile, 'activation.jep')
    expect(resolvedFirst.body.fileToken).toBe(resolvedSecond.body.fileToken)

    const verified = await request(app)
      .post('/api/public/user-invites/verify-code')
      .send({ fileToken: resolvedSecond.body.fileToken, code })
    expect(verified.status).toBe(200)
  })

  it('rotates the code: regenerating invalidates the previous code', async () => {
    const created = await createInvite(org)
    const fileBytes = await downloadFile(org, created.body.id)
    const firstCode = await generateCode(org, created.body.id)
    const secondCode = await generateCode(org, created.body.id)
    expect(firstCode).not.toBe(secondCode)

    const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', fileBytes, 'activation.jep')

    const failFirst = await request(app)
      .post('/api/public/user-invites/verify-code')
      .send({ fileToken: resolved.body.fileToken, code: firstCode })
    expect(failFirst.status).toBe(400)

    const okSecond = await request(app)
      .post('/api/public/user-invites/verify-code')
      .send({ fileToken: resolved.body.fileToken, code: secondCode })
    expect(okSecond.status).toBe(200)
  })

  it('rejects an expired activation code', async () => {
    const created = await createInvite(org)
    const fileBytes = await downloadFile(org, created.body.id)
    await generateCode(org, created.body.id)
    await prisma.userInvite.update({ where: { id: created.body.id }, data: { activationCodeExpiresAt: new Date(Date.now() - 1000) } })

    const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', fileBytes, 'activation.jep')
    const verified = await request(app)
      .post('/api/public/user-invites/verify-code')
      .send({ fileToken: resolved.body.fileToken, code: 'AAAAAAAA' })
    expect(verified.status).toBe(400)
  })

  it('rejects an invite past its overall hygiene expiry', async () => {
    const created = await createInvite(org)
    const fileBytes = await downloadFile(org, created.body.id)
    await prisma.userInvite.update({ where: { id: created.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } })

    const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', fileBytes, 'activation.jep')
    expect(resolved.status).toBe(404)
  })

  it('locks out the code after too many wrong attempts', async () => {
    const created = await createInvite(org)
    const fileBytes = await downloadFile(org, created.body.id)
    const code = await generateCode(org, created.body.id)
    const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', fileBytes, 'activation.jep')

    for (let i = 0; i < 5; i++) {
      const attempt = await request(app)
        .post('/api/public/user-invites/verify-code')
        .send({ fileToken: resolved.body.fileToken, code: 'WRONGCOD' })
      expect(attempt.status).toBe(400)
    }

    // Le vrai code échoue désormais aussi : le hash a été effacé par le verrouillage
    const finalAttempt = await request(app)
      .post('/api/public/user-invites/verify-code')
      .send({ fileToken: resolved.body.fileToken, code })
    expect(finalAttempt.status).toBe(400)
  })

  it('cannot activate without a prior successful code verification, and cannot replay a consumed activation token', async () => {
    const created = await createInvite(org)
    const fileBytes = await downloadFile(org, created.body.id)
    const code = await generateCode(org, created.body.id)
    const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', fileBytes, 'activation.jep')

    const skipStep = await request(app)
      .post('/api/public/user-invites/activate')
      .send({ fileToken: resolved.body.fileToken, activationToken: 'made-up-token', password: 'whatever123' })
    expect(skipStep.status).toBe(400)

    const verified = await request(app)
      .post('/api/public/user-invites/verify-code')
      .send({ fileToken: resolved.body.fileToken, code })
    const firstActivate = await request(app)
      .post('/api/public/user-invites/activate')
      .send({ fileToken: resolved.body.fileToken, activationToken: verified.body.activationToken, password: 'whatever123' })
    expect(firstActivate.status).toBe(201)

    const replay = await request(app)
      .post('/api/public/user-invites/activate')
      .send({ fileToken: resolved.body.fileToken, activationToken: verified.body.activationToken, password: 'whatever456' })
    expect(replay.status).toBe(404)
  })

  it('frees the username/email immediately on revoke', async () => {
    const username = `revoke-${Date.now()}`
    const email = `${username}@example.com`
    const created = await createInvite(org, { username, email })

    const revoked = await request(app).post(`/api/user-invites/${created.body.id}/revoke`).set('Authorization', `Bearer ${org.token}`)
    expect(revoked.status).toBe(200)
    expect(revoked.body.status).toBe('REVOKED')

    const secondInvite = await createInvite(org, { username, email })
    expect(secondInvite.status).toBe(201)
  })

  it('rejects duplicate username/email against an existing User or a PENDING invite', async () => {
    const dup = await createInvite(org, { username: org.username, email: `${org.username}-x@example.com` })
    expect(dup.status).toBe(400)

    const username = `dup-${Date.now()}`
    const email = `${username}@example.com`
    const first = await createInvite(org, { username, email })
    expect(first.status).toBe(201)
    const second = await createInvite(org, { username, email })
    expect(second.status).toBe(400)
  })

  it('resolves an invite by its fileToken (email link) the same way as the uploaded file', async () => {
    const created = await createInvite(org)
    const fileBytes = await downloadFile(org, created.body.id)
    const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', fileBytes, 'activation.jep')

    const byLink = await request(app).get(`/api/public/user-invites/resolve-by-token?token=${resolved.body.fileToken}`)
    expect(byLink.status).toBe(200)
    expect(byLink.body.fileToken).toBe(resolved.body.fileToken)
    expect(byLink.body.organizationName).toBe(resolved.body.organizationName)
  })

  it('rejects a made-up or unknown token on resolve-by-token, never 500s', async () => {
    const res = await request(app).get('/api/public/user-invites/resolve-by-token?token=not-a-real-token')
    expect(res.status).toBe(404)
  })

  it('does not send an invitation email when the org has no Resend account connected', async () => {
    const bareOrg = await seedOrg('invite-no-resend')
    await prisma.organization.update({ where: { id: bareOrg.organizationId }, data: { resendApiKeyEnc: null, emailContact: null } })

    const created = await createInvite(bareOrg)
    expect(created.status).toBe(201)
    expect(created.body.emailSent).toBe(false)
    expect(resendSendCalls).toHaveLength(0)

    await cleanupOrg(bareOrg.organizationId)
  })

  describe('tenant isolation', () => {
    it('does not let org B list, download, or generate a code for org A\'s invite', async () => {
      const created = await createInvite(org)

      const listB = await request(app).get('/api/user-invites').set('Authorization', `Bearer ${orgB.token}`)
      expect(listB.body.find((i: { id: string }) => i.id === created.body.id)).toBeUndefined()

      const fileB = await request(app).get(`/api/user-invites/${created.body.id}/file`).set('Authorization', `Bearer ${orgB.token}`)
      expect(fileB.status).toBe(404)

      const codeB = await request(app).post(`/api/user-invites/${created.body.id}/activation-code`).set('Authorization', `Bearer ${orgB.token}`)
      expect(codeB.status).toBe(404)
    })

    it('always activates the user under the organization actually encoded in the file, regardless of caller', async () => {
      const created = await createInvite(org)
      const fileBytes = await downloadFile(org, created.body.id)
      const code = await generateCode(org, created.body.id)

      const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', fileBytes, 'activation.jep')
      const verified = await request(app)
        .post('/api/public/user-invites/verify-code')
        .send({ fileToken: resolved.body.fileToken, code })
      const activated = await request(app)
        .post('/api/public/user-invites/activate')
        .send({ fileToken: resolved.body.fileToken, activationToken: verified.body.activationToken, password: 'whatever789' })

      const createdUser = await prisma.user.findUnique({ where: { id: activated.body.user.id } })
      expect(createdUser?.organizationId).toBe(org.organizationId)
    })

    it('rejects a made-up fileToken cleanly, never 500s', async () => {
      const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', Buffer.from('not a real file'), 'fake.jep')
      expect(resolved.status).toBe(400)
    })
  })
})
