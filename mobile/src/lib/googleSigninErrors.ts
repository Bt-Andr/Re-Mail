// Miroir de webmail/src/features/auth/GoogleCallbackPage.tsx — même mapping, deux
// implémentations (web/mobile n'ont pas de code partagé entre apps). Utilisé par
// welcome.tsx, login.tsx et signup.tsx (les trois écrans qui affichent une erreur de
// connexion Google), et indirectement par google-callback.tsx qui relaie le code brut
// via les search params plutôt que de le traduire lui-même (aucun de ces écrans n'affiche
// d'erreur directement, welcome.tsx est le point d'atterrissage réel).
export const GOOGLE_SIGNIN_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: 'Consentement Google annulé.',
  state_invalid: 'La demande de connexion a expiré, réessayez.',
  token_exchange_failed: 'La connexion à Google a échoué.',
  account_provisioning_failed: 'Connexion impossible avec ce compte Google. Réessayez dans quelques instants.',
}

export function describeGoogleSigninError(code: string): string {
  return GOOGLE_SIGNIN_ERROR_MESSAGES[code] ?? 'La connexion avec Google a échoué.'
}
