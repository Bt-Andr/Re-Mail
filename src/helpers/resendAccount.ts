import crypto from 'crypto'
import type { Organization } from '@prisma/client'
import { encrypt, decrypt } from '../lib/crypto'

// Points d'entrée uniques pour déchiffrer les identifiants Resend d'une org —
// tout le reste du code doit passer par ici plutôt que lire *Enc directement,
// pour que le déchiffrement reste traçable et jamais mis en cache au-delà de la requête.
export function getDecryptedResendKey(org: Pick<Organization, 'resendApiKeyEnc'>): string {
  if (!org.resendApiKeyEnc) throw new Error('Aucune clé Resend connectée pour cette organisation')
  return decrypt(org.resendApiKeyEnc)
}

export function getDecryptedWebhookSecret(org: Pick<Organization, 'webhookSecretEnc'>): string {
  if (!org.webhookSecretEnc) throw new Error('Aucun secret de webhook configuré pour cette organisation')
  return decrypt(org.webhookSecretEnc)
}

export function encryptResendKey(apiKey: string): { enc: string; last4: string } {
  return { enc: encrypt(apiKey), last4: apiKey.slice(-4) }
}

export function encryptWebhookSecret(secret: string): string {
  return encrypt(secret)
}

export function generateWebhookToken(): string {
  return crypto.randomBytes(24).toString('hex')
}

export interface ResendDomain {
  id: string
  name: string
  status: string
}

// Valide une clé API en listant les domaines de CE compte Resend — sert à la fois
// à vérifier que la clé est correcte et à proposer les domaines déjà vérifiés
// côté Resend pendant l'onboarding (voir routes/organizations.ts).
export async function listResendDomains(apiKey: string): Promise<ResendDomain[]> {
  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Clé API Resend invalide' : `Erreur Resend (${res.status})`)
  }
  const json = (await res.json()) as { data?: ResendDomain[] }
  return json.data ?? []
}
