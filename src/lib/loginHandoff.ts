import crypto from 'crypto'
import prisma from './prisma'

const HANDOFF_TTL_MS = 60 * 1000

// Émis à la fin du flux "se connecter avec Google" (routes/gmailOAuth.ts, intent
// 'signin') pour transporter l'identité d'un utilisateur au travers d'une redirection
// GET publique jusqu'à POST /auth/google/exchange, sans jamais mettre le vrai JWT de
// session dans une URL (historique navigateur, logs serveur, en-tête Referrer). Usage
// unique — voir consumeLoginHandoff.
export async function issueLoginHandoff(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  await prisma.loginHandoff.create({
    data: { tokenHash, userId, expiresAt: new Date(Date.now() + HANDOFF_TTL_MS) },
  })
  // Best-effort : purge les jetons expirés à chaque émission plutôt qu'un cron dédié —
  // la table reste minuscule et à très forte rotation (60s de durée de vie).
  prisma.loginHandoff.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {})
  return token
}

// Retourne le userId si le jeton est valide, non expiré et pas déjà consommé — sinon
// null. Le marquage usedAt utilise updateMany (pas update) avec usedAt:null dans le
// where : c'est cette condition qui rend la consommation atomique, garantissant qu'un
// jeton ne peut être échangé qu'une seule fois même en cas d'appels concurrents.
export async function consumeLoginHandoff(token: string): Promise<string | null> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const result = await prisma.loginHandoff.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  })
  if (result.count === 0) return null
  const handoff = await prisma.loginHandoff.findUnique({ where: { tokenHash } })
  return handoff?.userId ?? null
}
