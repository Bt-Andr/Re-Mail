import { Router } from 'express'
import prisma from '../lib/prisma'
import config from '../config'
import { authenticateToken, requireOrgRole } from '../middleware/auth'
import {
  listResendDomains,
  encryptResendKey,
  encryptWebhookSecret,
  generateWebhookToken,
} from '../helpers/resendAccount'

const router = Router()

function webhookUrlFor(webhookToken: string): string {
  return `${config.backendUrl}/api/inbound-mail/${webhookToken}`
}

// Résumé d'onboarding : sert à afficher la checklist "Connecter Resend → coller
// l'URL de webhook → créer une route mail" dans le dashboard.
router.get('/me', authenticateToken, async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } })
  if (!org) return res.status(404).json({ error: 'Organisation introuvable.' })

  const mailRoutesCount = await prisma.mailRoute.count({ where: { organizationId: org.id } })

  res.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    companyName: org.companyName,
    emailContact: org.emailContact,
    resendConnected: !!org.resendApiKeyEnc,
    resendApiKeyLast4: org.resendApiKeyLast4,
    resendVerifiedDomain: org.resendVerifiedDomain,
    webhookConfigured: !!org.webhookSecretEnc,
    webhookUrl: webhookUrlFor(org.webhookToken),
    mailRoutesCount,
  })
})

router.put('/me', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { name, companyName, emailContact } = req.body
  const data: Record<string, unknown> = {}
  if (typeof name === 'string' && name.trim()) data.name = name.trim()
  if (typeof companyName === 'string') data.companyName = companyName.trim() || null
  if (typeof emailContact === 'string') data.emailContact = emailContact.trim() || null

  const org = await prisma.organization.update({ where: { id: req.user!.organizationId }, data })
  res.json({ id: org.id, name: org.name, companyName: org.companyName, emailContact: org.emailContact })
})

// Étape 1 : l'org colle sa clé API Resend — on la valide en listant ses domaines
// (401 => clé invalide) et on la stocke chiffrée. On renvoie aussi l'URL de
// webhook unique à coller côté Resend (Domaines → Inbound).
router.post('/me/resend/connect', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { apiKey } = req.body
  if (!apiKey || typeof apiKey !== 'string') return res.status(400).json({ error: 'apiKey requis.' })

  try {
    const domains = await listResendDomains(apiKey)
    const { enc, last4 } = encryptResendKey(apiKey)

    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { resendApiKeyEnc: enc, resendApiKeyLast4: last4, resendConnectedAt: new Date() },
    })

    res.json({
      verifiedDomains: domains.filter(d => d.status === 'verified').map(d => d.name),
      webhookUrl: webhookUrlFor(org.webhookToken),
    })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

router.post('/me/resend/select-domain', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { domain } = req.body
  if (!domain || typeof domain !== 'string') return res.status(400).json({ error: 'domain requis.' })
  const org = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: { resendVerifiedDomain: domain.trim() },
  })
  res.json({ resendVerifiedDomain: org.resendVerifiedDomain })
})

// Étape manuelle : Resend n'expose pas le secret de signature d'un webhook via
// API — l'org le colle elle-même après l'avoir créé dans son propre dashboard.
router.post('/me/resend/webhook-secret', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const { webhookSecret } = req.body
  if (!webhookSecret || typeof webhookSecret !== 'string') {
    return res.status(400).json({ error: 'webhookSecret requis.' })
  }
  await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: { webhookSecretEnc: encryptWebhookSecret(webhookSecret) },
  })
  res.json({ connected: true })
})

// Rotation en cas de fuite du token : l'ancienne URL de webhook devient
// immédiatement invalide (404), l'org doit la remettre à jour côté Resend.
router.post('/me/resend/regenerate-webhook-token', authenticateToken, requireOrgRole(['OWNER', 'ADMIN']), async (req, res) => {
  const org = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: { webhookToken: generateWebhookToken() },
  })
  res.json({ webhookUrl: webhookUrlFor(org.webhookToken) })
})

export default router
