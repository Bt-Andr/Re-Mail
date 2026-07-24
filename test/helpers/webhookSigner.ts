import crypto from 'crypto'

// Reproduit exactement le calcul de src/helpers/webhookSignature.ts pour signer
// des payloads de test comme le ferait Resend (schéma Svix).
export function signTestWebhook(secret: string, rawBody: string, timestamp = Math.floor(Date.now() / 1000)) {
  const svixId = `msg_test_${Math.random().toString(36).slice(2)}`
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${svixId}.${timestamp}.${rawBody}`
  const signature = crypto.createHmac('sha256', key).update(signedContent).digest('base64')
  return {
    'svix-id': svixId,
    'svix-timestamp': String(timestamp),
    'svix-signature': `v1,${signature}`,
  }
}
