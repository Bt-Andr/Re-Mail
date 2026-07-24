import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma'
import config from '../../src/config'
import { encrypt } from '../../src/lib/crypto'

let counter = 0
function unique(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}`
}

export interface SeededOrg {
  organizationId: string
  userId: string
  username: string
  token: string
  webhookToken: string
  webhookSecret: string
}

// Crée une organisation complète (avec un compte Resend "connecté" factice) +
// un utilisateur OWNER, et renvoie un JWT valide pour ce user — pour les tests
// d'isolation tenant et du webhook entrant, sans dépendre d'un vrai compte Resend.
export async function seedOrg(namePrefix = 'org'): Promise<SeededOrg> {
  const webhookSecret = 'whsec_dGVzdHNlY3JldGZvcnRlc3RzMTIzNDU2Nzg5MA=='
  const org = await prisma.organization.create({
    data: {
      name: unique(namePrefix),
      slug: unique(`${namePrefix}-slug`),
      companyName: 'Test Co',
      emailContact: 'contact@test-co.example',
      resendApiKeyEnc: encrypt('re_test_fake_key'),
      resendApiKeyLast4: 'fake',
      webhookSecretEnc: encrypt(webhookSecret),
    },
  })

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      username: unique('user'),
      email: `${unique('user')}@test-co.example`,
      password: await bcrypt.hash('password123', 4),
      nom: 'Test User',
      orgRole: 'OWNER',
    },
  })

  const token = jwt.sign(
    { id: user.id, organizationId: org.id, username: user.username, orgRole: user.orgRole, nom: user.nom },
    config.jwtSecret,
    { expiresIn: '1h' }
  )

  return { organizationId: org.id, userId: user.id, username: user.username, token, webhookToken: org.webhookToken, webhookSecret }
}

export async function cleanupOrg(organizationId: string): Promise<void> {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {})
}
