import config from '../config'
import { encryptWithKey, decryptWithKey } from './crypto'

// Clé DÉDIÉE aux identifiants de boîtes externes (mot de passe IMAP/SMTP aujourd'hui,
// refresh token OAuth demain), distincte de MASTER_ENCRYPTION_KEY : c'est l'accès complet
// d'un UTILISATEUR à sa propre boîte mail (Gmail, Outlook, IMAP perso...), un domaine de
// confiance différent des clés Resend de l'organisation. Séparer les clés limite le rayon
// d'impact si l'une fuite — même raisonnement que INVITE_FILE_ENCRYPTION_KEY.
function mailboxCredentialKey(): Buffer {
  const key = Buffer.from(config.mailboxCredentialEncryptionKey, 'base64')
  if (key.length !== 32) {
    throw new Error('MAILBOX_CREDENTIAL_ENCRYPTION_KEY doit décoder en 32 octets (openssl rand -base64 32)')
  }
  return key
}

export function encryptMailboxCredential(plaintext: string): string {
  return encryptWithKey(plaintext, mailboxCredentialKey())
}

export function decryptMailboxCredential(payload: string): string {
  return decryptWithKey(payload, mailboxCredentialKey())
}
