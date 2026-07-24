import config from '../config'
import { encryptWithKey, decryptWithKey } from './crypto'

// Clé DÉDIÉE aux fichiers d'invitation, distincte de MASTER_ENCRYPTION_KEY : les
// fichiers d'invitation sont, par construction, supposés transiter par un canal
// quelconque (email, chat...), contrairement aux clés Resend (secrets d'infra
// longue durée). Séparer les clés évite qu'une rotation de l'une force celle de
// l'autre et limite le rayon d'impact si l'une fuite.
function inviteFileKey(): Buffer {
  const key = Buffer.from(config.inviteFileEncryptionKey, 'base64')
  if (key.length !== 32) {
    throw new Error('INVITE_FILE_ENCRYPTION_KEY doit décoder en 32 octets (openssl rand -base64 32)')
  }
  return key
}

export function encryptInviteFile(plaintext: string): string {
  return encryptWithKey(plaintext, inviteFileKey())
}

export function decryptInviteFile(payload: string): string {
  return decryptWithKey(payload, inviteFileKey())
}

// En-tête placé avant le contenu chiffré dans le fichier téléchargeable — permet
// un rejet rapide (400) sur un upload manifestement invalide avant tout déchiffrement.
export const INVITE_FILE_MAGIC = 'RMM-INVITE-V1'
