import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import config from '../config'
import prisma from '../lib/prisma'

// Le JWT porte organizationId depuis le login (routes/auth.ts) — jamais accepté
// depuis un header/body contrôlé par le client. C'est la seule source de vérité
// pour le scoping tenant (voir middleware/scopedPrisma.ts).
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    res.status(401).json({ error: 'Token manquant' })
    return
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret)
    if (
      typeof decoded === 'string' ||
      typeof decoded.id !== 'string' ||
      typeof decoded.organizationId !== 'string'
    ) {
      res.status(403).json({ error: 'Token invalide' })
      return
    }

    // L'identité et le rôle courants viennent toujours de la base. Un compte supprimé
    // ou rétrogradé perd donc immédiatement ses droits, même avec un JWT encore valide.
    const user = await prisma.user.findFirst({
      where: { id: decoded.id, organizationId: decoded.organizationId },
      select: { id: true, organizationId: true, username: true, orgRole: true, nom: true, sessionVersion: true },
    })
    const tokenSessionVersion = typeof decoded.sessionVersion === 'number' ? decoded.sessionVersion : 0
    if (!user || user.sessionVersion !== tokenSessionVersion) {
      res.status(403).json({ error: 'Token invalide' })
      return
    }
    const { sessionVersion: _sessionVersion, ...authenticatedUser } = user
    req.user = authenticatedUser
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Token invalide' })
      return
    }
    next(error)
  }
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
