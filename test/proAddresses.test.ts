import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import { seedOrg, cleanupOrg, SeededOrg } from './helpers/seed'

describe('Pro addresses — création/attribution (ThreadRoutingRule.assignToEmail) et claim', () => {
  let org: SeededOrg

  beforeAll(async () => {
    org = await seedOrg('pro-addr')
    await prisma.organization.update({ where: { id: org.organizationId }, data: { resendVerifiedDomain: 'pro-addr.example' } })
  })

  afterAll(async () => {
    await cleanupOrg(org.organizationId)
  })

  it('PUT .../:canal with assignToEmail resolves an existing user and creates the rule directly', async () => {
    const member = await prisma.user.create({
      data: { organizationId: org.organizationId, username: `member-${Date.now()}`, email: `member-${Date.now()}@pro-addr.example`, password: 'x', nom: 'Member', orgRole: 'MEMBER' },
    })

    const res = await request(app)
      .put('/api/thread-routing-rules/contact')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ assignToEmail: member.email })
    expect(res.status).toBe(200)
    expect(res.body.assignToId).toBe(member.id)

    const rule = await prisma.threadRoutingRule.findFirstOrThrow({ where: { organizationId: org.organizationId, canal: 'contact' } })
    expect(rule.assignToId).toBe(member.id)
    expect(rule.claimedAt).toBeNull()
  })

  it('PUT .../:canal with assignToEmail matching a PENDING invite stages the canal and creates no rule', async () => {
    const email = `pending-${Date.now()}@pro-addr.example`
    const invite = await prisma.userInvite.create({
      data: {
        organizationId: org.organizationId,
        fileToken: `tok-${Date.now()}`,
        username: `pending-${Date.now()}`,
        email,
        nom: 'Pending Person',
        orgRole: 'MEMBER',
        activationCodeHash: 'unused',
        expiresAt: new Date(Date.now() + 86400000),
        createdById: org.userId,
      },
    })

    const res = await request(app)
      .put('/api/thread-routing-rules/support')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ assignToEmail: email })
    expect(res.status).toBe(200)
    expect(res.body.staged).toBe(true)

    expect(await prisma.threadRoutingRule.findFirst({ where: { organizationId: org.organizationId, canal: 'support' } })).toBeNull()

    const updatedInvite = await prisma.userInvite.findUniqueOrThrow({ where: { id: invite.id } })
    expect(JSON.parse(updatedInvite.pendingRoutingCanaux!)).toContain('support')
  })

  it('PUT .../email is rejected — reserved canal used by every connected IMAP/Gmail mailbox org-wide', async () => {
    const member = await prisma.user.create({
      data: { organizationId: org.organizationId, username: `member-email-${Date.now()}`, email: `member-email-${Date.now()}@pro-addr.example`, password: 'x', nom: 'Member', orgRole: 'MEMBER' },
    })
    const res = await request(app)
      .put('/api/thread-routing-rules/email')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ assignToId: member.id })
    expect(res.status).toBe(400)
    expect(await prisma.threadRoutingRule.findFirst({ where: { organizationId: org.organizationId, canal: 'email' } })).toBeNull()

    // Insensible à la casse — un alias "EMAIL" contournerait sinon la protection.
    const upper = await request(app)
      .put('/api/thread-routing-rules/EMAIL')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ assignToId: member.id })
    expect(upper.status).toBe(400)
  })

  it('PUT .../:canal with assignToEmail matching neither a user nor a pending invite returns 404', async () => {
    const res = await request(app)
      .put('/api/thread-routing-rules/ghost')
      .set('Authorization', `Bearer ${org.token}`)
      .send({ assignToEmail: `nobody-${Date.now()}@nowhere.example` })
    expect(res.status).toBe(404)
    expect(await prisma.threadRoutingRule.findFirst({ where: { organizationId: org.organizationId, canal: 'ghost' } })).toBeNull()
  })

  it('GET /pro-addresses/mine returns [] when the org has no verified Resend domain', async () => {
    const bareOrg = await seedOrg('pro-addr-nodomain')
    const res = await request(app).get('/api/pro-addresses/mine').set('Authorization', `Bearer ${bareOrg.token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
    await cleanupOrg(bareOrg.organizationId)
  })

  it('GET /pro-addresses/mine lists the caller\'s attributed addresses, unclaimed by default', async () => {
    await prisma.threadRoutingRule.create({
      data: { organizationId: org.organizationId, canal: 'ventes', assignToId: org.userId, active: true },
    })

    const res = await request(app).get('/api/pro-addresses/mine').set('Authorization', `Bearer ${org.token}`)
    expect(res.status).toBe(200)
    const entry = res.body.find((a: { canal: string }) => a.canal === 'ventes')
    expect(entry).toMatchObject({ canal: 'ventes', email: 'ventes@pro-addr.example', claimedAt: null })
  })

  it('POST /pro-addresses/:id/claim sets claimedAt for the assigned user, idempotently', async () => {
    const rule = await prisma.threadRoutingRule.create({
      data: { organizationId: org.organizationId, canal: 'facturation', assignToId: org.userId, active: true },
    })

    const first = await request(app).post(`/api/pro-addresses/${rule.id}/claim`).set('Authorization', `Bearer ${org.token}`)
    expect(first.status).toBe(200)
    const claimed = await prisma.threadRoutingRule.findUniqueOrThrow({ where: { id: rule.id } })
    expect(claimed.claimedAt).not.toBeNull()

    const second = await request(app).post(`/api/pro-addresses/${rule.id}/claim`).set('Authorization', `Bearer ${org.token}`)
    expect(second.status).toBe(200)
  })

  it('POST /pro-addresses/:id/claim returns 404 for a rule assigned to someone else, without revealing it exists', async () => {
    const otherOrg = await seedOrg('pro-addr-other')
    const otherRule = await prisma.threadRoutingRule.create({
      data: { organizationId: otherOrg.organizationId, canal: 'prive', assignToId: otherOrg.userId, active: true },
    })

    const res = await request(app).post(`/api/pro-addresses/${otherRule.id}/claim`).set('Authorization', `Bearer ${org.token}`)
    expect(res.status).toBe(404)
    const untouched = await prisma.threadRoutingRule.findUniqueOrThrow({ where: { id: otherRule.id } })
    expect(untouched.claimedAt).toBeNull()

    await cleanupOrg(otherOrg.organizationId)
  })
})
