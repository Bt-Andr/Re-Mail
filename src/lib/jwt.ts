import jwt from 'jsonwebtoken'
import config from '../config'

// Utilisé par tout ce qui doit renvoyer une session utilisateur valide :
// POST /api/auth/login, POST /api/auth/signup, et POST /api/public/user-invites/activate
// (l'activation par fichier doit aboutir à la même forme de réponse qu'un login classique).
export function signToken(user: { id: string; organizationId: string; username: string; orgRole: string; nom: string }): string {
  return jwt.sign(
    { id: user.id, organizationId: user.organizationId, username: user.username, orgRole: user.orgRole, nom: user.nom },
    config.jwtSecret,
    { expiresIn: '24h' }
  )
}
