import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import app from '../src/app'
import config from '../src/config'
import prisma from '../src/lib/prisma'
import { cleanupOrg, seedOrg, type SeededOrg } from './helpers/seed'

function tokenFor(user: { id: string; organizationId: string; username: string; orgRole: 'OWNER' | 'ADMIN' | 'MEMBER'; nom: string }) {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '1h' })
}

async function createUser(org: SeededOrg, role: 'OWNER' | 'ADMIN' | 'MEMBER', suffix: string) {
  return prisma.user.create({
    data: {
      organizationId: org.organizationId,
      username: `${suffix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      email: `${suffix}-${Date.now()}-${Math.random().toString(36).slice(2)}@roles.example`,
      password: 'hashed-test-password',
      nom: suffix,
      orgRole: role,
    },
  })
}

describe('Account role governance', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('account-roles')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('prevents direct OWNER creation and keeps ADMIN management below its own role', async () => {
    const admin = await createUser(org, 'ADMIN', 'Admin')
    const peerAdmin = await createUser(org, 'ADMIN', 'Peer admin')
    const member = await createUser(org, 'MEMBER', 'Member')
    const secondOwner = await createUser(org, 'OWNER', 'Second owner')
    const adminToken = tokenFor(admin)
    const authAdmin = { Authorization: `Bearer ${adminToken}` }
    const authOwner = { Authorization: `Bearer ${org.token}` }
    const newUser = {
      username: `new-${Date.now()}`,
      email: `new-${Date.now()}@roles.example`,
      password: 'password123',
      nom: 'New user',
    }

    expect((await request(app).post('/api/users').set(authAdmin).send({ ...newUser, orgRole: 'OWNER' })).status).toBe(403)
    expect((await request(app).post('/api/users').set(authAdmin).send({ ...newUser, orgRole: 'ADMIN' })).status).toBe(403)
    expect((await request(app).post('/api/users').set(authOwner).send({ ...newUser, orgRole: 'OWNER' })).status).toBe(403)

    const invite = { username: `invite-${Date.now()}`, email: `invite-${Date.now()}@roles.example`, nom: 'Invited user' }
    expect((await request(app).post('/api/user-invites').set(authAdmin).send({ ...invite, orgRole: 'ADMIN' })).status).toBe(403)
    expect((await request(app).post('/api/user-invites').set(authAdmin).send({ ...invite, orgRole: 'OWNER' })).status).toBe(403)
    expect((await request(app).post('/api/user-invites').set(authOwner).send({ ...invite, orgRole: 'OWNER' })).status).toBe(403)

    expect((await request(app).put(`/api/users/${org.userId}`).set(authAdmin).send({ nom: 'Hijacked' })).status).toBe(403)
    expect((await request(app).put(`/api/users/${member.id}`).set(authAdmin).send({ orgRole: 'ADMIN' })).status).toBe(403)
    expect((await request(app).delete(`/api/users/${peerAdmin.id}`).set(authAdmin)).status).toBe(403)

    expect((await request(app).put(`/api/users/${org.userId}`).set(authOwner).send({ orgRole: 'ADMIN' })).status).toBe(409)
    expect((await request(app).delete(`/api/users/${secondOwner.id}`).set(authOwner)).status).toBe(409)

    const unchanged = await prisma.user.findMany({
      where: { id: { in: [org.userId, admin.id, member.id, secondOwner.id] } },
      select: { id: true, nom: true, orgRole: true },
    })
    expect(unchanged.find(user => user.id === org.userId)).toMatchObject({ nom: 'Test User', orgRole: 'OWNER' })
    expect(unchanged.find(user => user.id === member.id)?.orgRole).toBe('MEMBER')
    expect(unchanged.find(user => user.id === admin.id)?.orgRole).toBe('ADMIN')
    expect(unchanged.find(user => user.id === secondOwner.id)?.orgRole).toBe('OWNER')
  })

  it('transfers ownership atomically and applies database roles to already-issued tokens', async () => {
    const fresh = await seedOrg('ownership-transfer')
    const target = await createUser(fresh, 'ADMIN', 'Target owner')
    const next = await createUser(fresh, 'MEMBER', 'Next owner')
    const targetOldToken = tokenFor(target)

    const transferred = await request(app)
      .post(`/api/users/${target.id}/transfer-ownership`)
      .set('Authorization', `Bearer ${fresh.token}`)
    expect(transferred.status).toBe(200)
    expect(transferred.body.owner).toMatchObject({ id: target.id, orgRole: 'OWNER' })

    const roles = await prisma.user.findMany({
      where: { id: { in: [fresh.userId, target.id] } },
      select: { id: true, orgRole: true },
    })
    expect(roles.find(user => user.id === fresh.userId)?.orgRole).toBe('ADMIN')
    expect(roles.find(user => user.id === target.id)?.orgRole).toBe('OWNER')

    // Le JWT initial du propriétaire est rétrogradé immédiatement par le lookup DB.
    const staleOwner = await request(app)
      .post(`/api/users/${next.id}/transfer-ownership`)
      .set('Authorization', `Bearer ${fresh.token}`)
    expect(staleOwner.status).toBe(403)

    // Inversement, le JWT émis quand la cible était ADMIN bénéficie de son rôle OWNER courant.
    const currentOwner = await request(app)
      .post(`/api/users/${next.id}/transfer-ownership`)
      .set('Authorization', `Bearer ${targetOldToken}`)
    expect(currentOwner.status).toBe(200)

    await cleanupOrg(fresh.organizationId)
  })

  it('allows only one of two concurrent transfers from the same owner', async () => {
    const fresh = await seedOrg('ownership-race')
    const first = await createUser(fresh, 'ADMIN', 'First target')
    const second = await createUser(fresh, 'ADMIN', 'Second target')

    const responses = await Promise.all([
      request(app).post(`/api/users/${first.id}/transfer-ownership`).set('Authorization', `Bearer ${fresh.token}`),
      request(app).post(`/api/users/${second.id}/transfer-ownership`).set('Authorization', `Bearer ${fresh.token}`),
    ])
    const statuses = responses.map(response => response.status)
    expect(statuses.filter(status => status === 200)).toHaveLength(1)
    expect(statuses.filter(status => status === 403 || status === 409)).toHaveLength(1)

    const owners = await prisma.user.count({ where: { organizationId: fresh.organizationId, orgRole: 'OWNER' } })
    expect(owners).toBe(1)

    await cleanupOrg(fresh.organizationId)
  })

  it('rejects an already-issued token as soon as its account is deleted', async () => {
    const fresh = await seedOrg('deleted-session')
    const member = await createUser(fresh, 'MEMBER', 'Deleted member')
    const memberToken = tokenFor(member)

    const deleted = await request(app)
      .delete(`/api/users/${member.id}`)
      .set('Authorization', `Bearer ${fresh.token}`)
    expect(deleted.status).toBe(200)

    const staleSession = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(staleSession.status).toBe(403)

    await cleanupOrg(fresh.organizationId)
  })
})
