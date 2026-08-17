import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.PLATFORM_ADMIN_PASSWORD
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || 'Administrateur plateforme'
  if (!email || !password || password.length < 12) {
    throw new Error('Définissez PLATFORM_ADMIN_EMAIL et PLATFORM_ADMIN_PASSWORD (12 caractères minimum).')
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    create: { email, name, passwordHash },
    update: { name, passwordHash, active: true },
    select: { id: true, email: true, name: true },
  })
  console.log(`Administrateur plateforme prêt : ${admin.email} (${admin.id})`)
}

main().finally(() => prisma.$disconnect())
