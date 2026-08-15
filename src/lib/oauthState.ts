import jwt from 'jsonwebtoken'
import config from '../config'

// Le callback OAuth (déclenché par une redirection GET de Google) n'a jamais d'en-tête
// Authorization — cette app authentifie tout le reste par JWT en header, jamais par
// cookie. Ce state signé (10 min, PAS 24h comme signToken : ce n'est pas une session de
// connexion, juste une preuve d'intégrité le temps de l'aller-retour vers Google) sert à
// retrouver qui a initié le flux et où le renvoyer une fois terminé.
// intent 'connect' : connecter une boîte externe à un compte DÉJÀ authentifié
// (userId/organizationId signés depuis /gmail/start). intent 'signin' : se connecter à
// Re-Mail directement via Google, sans session préalable — voir /gmail/start-signin
// (userId/organizationId n'existent pas encore à cet instant, résolus dans le callback
// lui-même). Union discriminée (pas des champs optionnels sur une interface plate) pour
// que TypeScript garantisse userId/organizationId présents sur la branche 'connect'.
export type OAuthState =
  | { intent: 'connect'; returnTo: string; userId: string; organizationId: string }
  | { intent: 'signin'; returnTo: string }

export function signOAuthState(state: OAuthState): string {
  return jwt.sign(state, config.jwtSecret, { expiresIn: '10m' })
}

export function verifyOAuthState(token: string): OAuthState {
  return jwt.verify(token, config.jwtSecret) as OAuthState
}
