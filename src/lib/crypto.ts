import crypto from 'crypto'
import config from '../config'

const ALGO = 'aes-256-gcm'

function masterKey(): Buffer {
  const key = Buffer.from(config.masterEncryptionKey, 'base64')
  if (key.length !== 32) {
    throw new Error('MASTER_ENCRYPTION_KEY doit décoder en 32 octets (openssl rand -base64 32)')
  }
  return key
}

// Chiffre avec une clé arbitraire — utilisé par encrypt() (clé maîtresse) et par
// src/lib/inviteFileCrypto.ts (clé dédiée aux fichiers d'invitation), pour garder
// deux domaines de confiance séparés sans dupliquer la logique AES-256-GCM.
// Format : "{iv}.{authTag}.{ciphertext}", chaque partie en base64.
export function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, ciphertext].map(b => b.toString('base64')).join('.')
}

// Déchiffre une valeur produite par encryptWithKey(). Lève une erreur si le payload
// a été altéré (échec de vérification du tag GCM) ou est mal formé.
export function decryptWithKey(payload: string, key: Buffer): string {
  const parts = payload.split('.')
  if (parts.length !== 3) throw new Error('Payload chiffré mal formé')
  const [ivB64, tagB64, dataB64] = parts
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

// Chiffre une valeur sensible (clé API Resend, secret de webhook) avant stockage en base,
// avec la clé maîtresse de la plateforme.
export function encrypt(plaintext: string): string {
  return encryptWithKey(plaintext, masterKey())
}

export function decrypt(payload: string): string {
  return decryptWithKey(payload, masterKey())
}
