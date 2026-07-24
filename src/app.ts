import express from 'express'
import cors from 'cors'
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

const app = express()

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

export default app
