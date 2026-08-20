import express from 'express'
import cors from 'cors'
// Doit être importé avant l'enregistrement des routes : patche Router pour que le
// rejet d'une promesse dans un handler async soit transmis à `next(err)` au lieu de
// remonter en unhandled rejection (Express 4 ne le fait pas nativement — Node crashe
// tout le process, pour toutes les organisations, sur une seule erreur non rattrapée
// dans un handler, ex. un déchiffrement de clé Resend corrompue pour un seul tenant).
import 'express-async-errors'
import config from './config'

import authRoutes from './routes/auth'
import organizationRoutes from './routes/organizations'
import mailRoutes from './routes/mail'
import mailRouteRoutes from './routes/mailRoutes'
import threadRoutes from './routes/threads'
import draftRoutes from './routes/drafts'
import routingRuleRoutes from './routes/routingRules'
import replyTemplateRoutes from './routes/replyTemplates'
import deviceRoutes from './routes/devices'
import userRoutes from './routes/users'
import userInviteRoutes from './routes/userInvites'
import publicUserInviteRoutes from './routes/publicUserInvites'
import contactRoutes from './routes/contacts'
import mailboxConnectionRoutes from './routes/mailboxConnections'
import gmailOAuthRoutes from './routes/gmailOAuth'
import accountRoutes from './routes/accounts'
import platformRoutes from './routes/platform'
import proAddressRoutes from './routes/proAddresses'

const app = express()

// Nécessaire pour que req.ip (utilisé par le rate limiting sur /auth) reflète le
// vrai client et non le reverse proxy de la plateforme d'hébergement (Render) —
// sans ça toutes les requêtes partageraient la même IP côté serveur.
app.set('trust proxy', 1)

app.use(cors({ origin: config.allowedOrigins, credentials: true }))

// Capture le corps brut (Buffer) de chaque requête AVANT parsing JSON — nécessaire
// pour vérifier la signature Svix du webhook Resend, qui porte sur les octets
// exacts du corps reçu (voir helpers/webhookSignature.ts).
app.use(
  express.json({
    verify: (req, _res, buf) => {
      ;(req as express.Request).rawBody = Buffer.from(buf)
    },
  })
)

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRoutes)
app.use('/api/organizations', organizationRoutes)
app.use('/api', mailRoutes) // /api/emails/reply, /api/inbound-mail/:webhookToken
app.use('/api/mail-routes', mailRouteRoutes)
app.use('/api/threads', threadRoutes)
app.use('/api/drafts', draftRoutes)
app.use('/api/thread-routing-rules', routingRuleRoutes)
app.use('/api/reply-templates', replyTemplateRoutes)
app.use('/api/devices', deviceRoutes)
app.use('/api/users', userRoutes)
app.use('/api/user-invites', userInviteRoutes)
app.use('/api/public/user-invites', publicUserInviteRoutes)
app.use('/api/contacts', contactRoutes)
app.use('/api/mailbox-connections', mailboxConnectionRoutes)
app.use('/api/mailbox-connections', gmailOAuthRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/platform', platformRoutes)
app.use('/api/pro-addresses', proAddressRoutes)

// Filet de sécurité final : toute erreur qui atteint ici (async, throw synchrone,
// etc.) reçoit une réponse propre au lieu de laisser Express fermer la connexion en
// silence ou — sans express-async-errors — de faire planter le process entier.
// Jamais de stack trace / détail interne renvoyé au client, seulement loggé côté serveur.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err)
  if (res.headersSent) return
  res.status(500).json({ error: 'Erreur serveur.' })
})

export default app
