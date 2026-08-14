import jwt from 'jsonwebtoken'
import config from '../config'

// Le callback OAuth (déclenché par une redirection GET de Google) n'a jamais d'en-tête
// Authorization — cette app authentifie tout le reste par JWT en header, jamais par
// cookie. Ce state signé (10 min, PAS 24h comme signToken : ce n'est pas une session de
// connexion, juste une preuve d'intégrité le temps de l'aller-retour vers Google) sert à
// retrouver qui a initié le flux et où le renvoyer une fois terminé.
export interface OAuthState {
  userId: string
  organizationId: string
  returnTo: string
}

export function signOAuthState(state: OAuthState): string {
  return jwt.sign(state, config.jwtSecret, { expiresIn: '10m' })
}

export function verifyOAuthState(token: string): OAuthState {
  return jwt.verify(token, config.jwtSecret) as OAuthState
}
