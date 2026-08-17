import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import config from '../config'

type PlatformClaims = { scope: 'platform'; id: string; email: string; name: string }

export function signPlatformToken(admin: Omit<PlatformClaims, 'scope'>): string {
  return jwt.sign({ ...admin, scope: 'platform' }, config.platformAdminJwtSecret, { expiresIn: '8h' })
}

export function authenticatePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return void res.status(401).json({ error: 'Token plateforme manquant' })
  try {
    const claims = jwt.verify(token, config.platformAdminJwtSecret) as PlatformClaims
    if (claims.scope !== 'platform') return void res.status(403).json({ error: 'Token plateforme invalide' })
    req.platformAdmin = { id: claims.id, email: claims.email, name: claims.name }
    next()
  } catch {
    res.status(403).json({ error: 'Token plateforme invalide' })
  }
}
