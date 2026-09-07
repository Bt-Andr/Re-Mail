import app from './app'
import config from './config'
import { startMailboxPolling } from './jobs/mailboxPoller'
import { startInboundEventProcessing } from './jobs/inboundEventProcessor'
import { processInboundEmail } from './routes/mail'

app.listen(config.port, () => {
  console.log(`[SERVER] En écoute sur le port ${config.port} (${config.nodeEnv})`)
})

startMailboxPolling()
startInboundEventProcessing(processInboundEmail)
