import app from './app'
import config from './config'
import { startMailboxPolling } from './jobs/mailboxPoller'
import { startInboundEventProcessing } from './jobs/inboundEventProcessor'
import { processInboundEmail } from './services/inboundEmail'

app.listen(config.port, () => {
  console.log(`[SERVER] En écoute sur le port ${config.port} (${config.nodeEnv})`)
})

startMailboxPolling()
startInboundEventProcessing(processInboundEmail)
