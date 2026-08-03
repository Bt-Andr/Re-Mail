import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { csvRow } from '../src/lib/csv'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

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

describe('Pending routing rule / sender grant applied at invite activation', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('pending-assign')
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('creates the ThreadRoutingRule and SenderGrant only once the migrated user actually activates', async () => {
    const email = `migrated-${Date.now()}@legacy.example`
    const username = `migrated-${Date.now()}`

    let csv = '﻿'
    csv += csvRow(['Section', 'Domaine']) + csvRow(['domain']) + csvRow(['']) + '\r\n'
    csv += csvRow(['Section', 'Users']) + csvRow(['username', 'email', 'nom', 'proEmail', 'orgRole', 'isDeptHead'])
    csv += csvRow([username, email, 'Personne Migrée', '', 'MEMBER', 'false']) + '\r\n'
    csv += csvRow(['Section', 'Mail Routes']) + csvRow(['alias', 'personalEmail', 'displayName', 'active'])
    csv += csvRow(['rh@imported.example', '', '', 'true']) + '\r\n'
    csv += csvRow(['Section', 'Routing Rules']) + csvRow(['canal', 'assignToEmail', 'active'])
    csv += csvRow(['rh', email, 'true']) + '\r\n'
    csv += csvRow(['Section', 'Reply Templates']) + csvRow(['titre', 'canal', 'corps'])

    const imported = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${org.token}`)
      .attach('file', Buffer.from(csv, 'utf-8'), 'config.csv')
    expect(imported.status).toBe(200)
    expect(imported.body.routingRules.staged).toBe(1)

    const invite = await prisma.userInvite.findFirstOrThrow({ where: { organizationId: org.organizationId, email, status: 'PENDING' } })

    // Rien n'est accessible tant que l'admin n'a pas explicitement généré+transmis
    // le fichier et le code — deux actions séparées, comme pour une invitation créée à la main.
    expect(await prisma.threadRoutingRule.findFirst({ where: { organizationId: org.organizationId, canal: 'rh' } })).toBeNull()

    const fileBytes = await downloadFile(org, invite.id)
    const code = await generateCode(org, invite.id)

    const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', fileBytes, 'activation.jep')
    expect(resolved.status).toBe(200)

    const verified = await request(app).post('/api/public/user-invites/verify-code').send({ fileToken: resolved.body.fileToken, code })
    expect(verified.status).toBe(200)

    const activated = await request(app)
      .post('/api/public/user-invites/activate')
      .send({ fileToken: resolved.body.fileToken, activationToken: verified.body.activationToken, password: 'a-strong-password' })
    expect(activated.status).toBe(201)
    const newUserId = activated.body.user.id as string

    const rule = await prisma.threadRoutingRule.findFirstOrThrow({ where: { organizationId: org.organizationId, canal: 'rh' } })
    expect(rule.assignToId).toBe(newUserId)

    const grant = await prisma.senderGrant.findFirstOrThrow({ where: { organizationId: org.organizationId, userId: newUserId, email: 'rh@imported.example' } })
    expect(grant.email).toBe('rh@imported.example')
  })

  it('does not overwrite a routing rule an admin already assigned to someone else in the meantime', async () => {
    const email = `migrated2-${Date.now()}@legacy.example`
    const username = `migrated2-${Date.now()}`

    let csv = '﻿'
    csv += csvRow(['Section', 'Domaine']) + csvRow(['domain']) + csvRow(['']) + '\r\n'
    csv += csvRow(['Section', 'Users']) + csvRow(['username', 'email', 'nom', 'proEmail', 'orgRole', 'isDeptHead'])
    csv += csvRow([username, email, 'Personne Migrée 2', '', 'MEMBER', 'false']) + '\r\n'
    csv += csvRow(['Section', 'Mail Routes']) + csvRow(['alias', 'personalEmail', 'displayName', 'active'])
    csv += csvRow(['commercial@imported.example', '', '', 'true']) + '\r\n'
    csv += csvRow(['Section', 'Routing Rules']) + csvRow(['canal', 'assignToEmail', 'active'])
    csv += csvRow(['commercial', email, 'true']) + '\r\n'
    csv += csvRow(['Section', 'Reply Templates']) + csvRow(['titre', 'canal', 'corps'])

    const imported = await request(app)
      .post('/api/organizations/me/import')
      .set('Authorization', `Bearer ${org.token}`)
      .attach('file', Buffer.from(csv, 'utf-8'), 'config.csv')
    expect(imported.body.routingRules.staged).toBe(1)

    const invite = await prisma.userInvite.findFirstOrThrow({ where: { organizationId: org.organizationId, email, status: 'PENDING' } })

    // Un admin assigne "commercial" à quelqu'un d'autre avant que la personne migrée n'active son compte.
    const manualRule = await prisma.threadRoutingRule.create({
      data: { organizationId: org.organizationId, canal: 'commercial', assignToId: org.userId, active: true },
    })

    const fileBytes = await downloadFile(org, invite.id)
    const code = await generateCode(org, invite.id)
    const resolved = await request(app).post('/api/public/user-invites/resolve').attach('file', fileBytes, 'activation.jep')
    const verified = await request(app).post('/api/public/user-invites/verify-code').send({ fileToken: resolved.body.fileToken, code })
    const activated = await request(app)
      .post('/api/public/user-invites/activate')
      .send({ fileToken: resolved.body.fileToken, activationToken: verified.body.activationToken, password: 'a-strong-password' })
    expect(activated.status).toBe(201)

    const rule = await prisma.threadRoutingRule.findFirstOrThrow({ where: { id: manualRule.id } })
    expect(rule.assignToId).toBe(org.userId)
  })
})
