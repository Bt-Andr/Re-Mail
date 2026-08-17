import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { authenticatePlatformAdmin, signPlatformToken } from '../middleware/platformAuth'

const router = Router()

router.post('/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' })
  const admin = await prisma.platformAdmin.findUnique({ where: { email } })
  if (!admin?.active || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ error: 'Identifiants incorrects.' })
  }
  const token = signPlatformToken({ id: admin.id, email: admin.email, name: admin.name })
  res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } })
})

router.use(authenticatePlatformAdmin)

router.get('/summary', async (_req, res) => {
  const [organizations, users, threads, connectedResend, externalMailboxes] = await prisma.$transaction([
    prisma.organization.count(), prisma.user.count(), prisma.thread.count(),
    prisma.organization.count({ where: { resendConnectedAt: { not: null } } }),
    prisma.externalMailboxConnection.count(),
  ])
  res.json({ organizations, users, threads, connectedResend, externalMailboxes })
})

router.get('/organizations', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
  const search = String(req.query.search || '').trim()
  const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { companyName: { contains: search, mode: 'insensitive' as const } }, { slug: { contains: search, mode: 'insensitive' as const } }] } : {}
  const [items, total] = await prisma.$transaction([prisma.organization.findMany({
    where, skip: (page - 1) * pageSize, take: pageSize,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, companyName: true, slug: true, isPersonal: true,
      resendVerifiedDomain: true, resendConnectedAt: true, createdAt: true,
      _count: { select: { users: true, threads: true, mailRoutes: true, externalMailboxConnections: true } },
    },
  }), prisma.organization.count({ where })])
  res.json({ items, total, page, pageSize })
})

router.get('/organizations/:id', async (req, res) => {
  const organization = await prisma.organization.findUnique({ where: { id: req.params.id }, select: {
    id:true,name:true,companyName:true,emailContact:true,slug:true,isPersonal:true,resendVerifiedDomain:true,resendConnectedAt:true,createdAt:true,updatedAt:true,
    users:{orderBy:{createdAt:'desc'},select:{id:true,email:true,username:true,nom:true,orgRole:true,createdAt:true}},
    mailRoutes:{orderBy:{createdAt:'desc'},select:{id:true,alias:true,personalEmail:true,displayName:true,active:true,createdAt:true}},
    externalMailboxConnections:{orderBy:{createdAt:'desc'},select:{id:true,email:true,provider:true,status:true,lastError:true,lastPolledAt:true,createdAt:true}},
    _count:{select:{threads:true,threadMessages:true,userInvites:true}},
  } })
  if (!organization) return res.status(404).json({ error: 'Organisation introuvable.' })
  res.json(organization)
})

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, username: true, nom: true, orgRole: true, createdAt: true, organization: { select: { id: true, name: true, isPersonal: true } } },
  })
  res.json(users)
})

export default router
