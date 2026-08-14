import type { ExternalMailboxConnection } from '@prisma/client'
import { decryptMailboxCredential } from './mailboxCredentialCrypto'
import { refreshGoogleAccessToken } from './googleOAuth'

export type MailboxAuth = { user: string } & ({ pass: string } | { accessToken: string })

// Point d'entrée UNIQUE pour les identifiants IMAP/SMTP d'une connexion, quel que soit
// son provider — appelé juste avant CHAQUE connexion (poll ou envoi), jamais mis en
// cache : un refresh token Gmail redonne un access token neuf à chaque appel, pas de
// suivi d'expiration à gérer nous-mêmes.
export async function getMailboxAuth(connection: ExternalMailboxConnection): Promise<MailboxAuth> {
  if (connection.provider === 'gmail') {
    const refreshToken = decryptMailboxCredential(connection.credentialEnc)
    const accessToken = await refreshGoogleAccessToken(refreshToken)
    return { user: connection.email, accessToken }
  }
  // provider === 'imap' (une future Phase Outlook ajoutera une branche 'outlook' ici, même forme)
  return { user: connection.email, pass: decryptMailboxCredential(connection.credentialEnc) }
}
