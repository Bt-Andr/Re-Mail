import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import config from '../config'

// Le JWT porte organizationId depuis le login (routes/auth.ts) — jamais accepté
// depuis un header/body contrôlé par le client. C'est la seule source de vérité
// pour le scoping tenant (voir middleware/scopedPrisma.ts).
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    res.status(401).json({ error: 'Token manquant' })
    return
  }

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: 'Token invalide' })
      return
    }
    req.user = decoded as Express.Request['user']
    next()
  })
}

export function requireOrgRole(roles: ('OWNER' | 'ADMIN' | 'MEMBER')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.orgRole)) {
      res.status(403).json({ error: 'Accès non autorisé pour ce rôle' })
      return
    }
    next()
  }
}
