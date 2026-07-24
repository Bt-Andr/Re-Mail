import crypto from 'crypto'
import type { Request } from 'express'

const TOLERANCE_SECONDS = 5 * 60

// Vérifie la signature Svix des webhooks Resend.
// Schéma : HMAC-SHA256 de "{svix-id}.{svix-timestamp}.{corps brut}" avec le
// secret (base64 après le préfixe "whsec_"), comparé aux signatures "v1,xxx"
// de l'en-tête svix-signature.
//
// Contrairement à la version mono-tenant, `secret` est un paramètre — chaque
// organisation a son propre secret de webhook Resend (résolu par le routeur
// via l'org trouvée depuis le token dans l'URL, AVANT d'appeler cette fonction).
export function verifyResendWebhook(req: Request, secret: string): boolean {
  const svixId = req.header('svix-id')
  const svixTimestamp = req.header('svix-timestamp')
  const svixSignature = req.header('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature || !req.rawBody) return false

  // Anti-rejeu : timestamp trop ancien ou dans le futur
  const timestamp = parseInt(svixTimestamp, 10)
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) {
    return false
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${svixId}.${svixTimestamp}.${req.rawBody.toString('utf8')}`
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64')
  const expectedBuf = Buffer.from(expected)

  // L'en-tête peut contenir plusieurs signatures séparées par des espaces : "v1,abc v1,def"
  return svixSignature.split(' ').some(part => {
    const sig = part.startsWith('v1,') ? part.slice(3) : part
    const sigBuf = Buffer.from(sig)
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)
  })
}
