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

router.get('/organizations', async (_req, res) => {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, companyName: true, slug: true, isPersonal: true,
      resendVerifiedDomain: true, resendConnectedAt: true, createdAt: true,
      _count: { select: { users: true, threads: true, mailRoutes: true, externalMailboxConnections: true } },
    },
  })
  res.json(organizations)
})

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, username: true, nom: true, orgRole: true, createdAt: true, organization: { select: { id: true, name: true, isPersonal: true } } },
  })
  res.json(users)
})

export default router
