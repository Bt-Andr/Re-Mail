import app from './app'
import config from './config'

app.listen(config.port, () => {
  console.log(`[SERVER] En écoute sur le port ${config.port} (${config.nodeEnv})`)
})
