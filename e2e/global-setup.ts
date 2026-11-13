import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'
import path from 'node:path'
import type { FullConfig } from '@playwright/test'
import { createServer as createViteServer, type ViteDevServer } from 'vite'

const host = '127.0.0.1'
const apiPort = 3101
const adminPort = 4173
const webmailPort = 4174
const apiOrigin = `http://${host}:${apiPort}`
const adminOrigin = `http://${host}:${adminPort}`
const webmailOrigin = `http://${host}:${webmailPort}`

function listen(server: HttpServer, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error)
    server.once('error', onError)
    server.listen(port, host, () => {
      server.off('error', onError)
      resolve()
    })
  })
}

function closeHttp(server: HttpServer | undefined): Promise<void> {
  if (!server) return Promise.resolve()
  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()))
  })
}

export default async function globalSetup(_config: FullConfig) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: String(apiPort),
    DATABASE_URL:
      process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:test@127.0.0.1:5433/resend_mail_e2e',
    JWT_SECRET: 're-mail-e2e-jwt-secret',
    PLATFORM_ADMIN_JWT_SECRET: 're-mail-e2e-platform-secret',
    MASTER_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    INVITE_FILE_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
    MAILBOX_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
    FRONTEND_URL: adminOrigin,
    WEBMAIL_URL: webmailOrigin,
    BACKEND_URL: apiOrigin,
    ALLOWED_ORIGINS: `${adminOrigin},${webmailOrigin}`,
    VITE_API_URL: `${apiOrigin}/api`,
    VITE_ADMIN_URL: adminOrigin,
    VITE_WEBMAIL_URL: webmailOrigin,
  })

  let apiServer: HttpServer | undefined
  let adminServer: ViteDevServer | undefined
  let webmailServer: ViteDevServer | undefined

  try {
    const { default: app } = await import('../src/app')
    apiServer = createHttpServer(app)
    await listen(apiServer, apiPort)

    adminServer = await createViteServer({
      root: path.resolve('web'),
      configFile: path.resolve('web/vite.config.ts'),
      logLevel: 'warn',
      css: { postcss: path.resolve('web') },
      server: { host, port: adminPort, strictPort: true },
    })
    await adminServer.listen()

    webmailServer = await createViteServer({
      root: path.resolve('webmail'),
      configFile: path.resolve('webmail/vite.config.ts'),
      logLevel: 'warn',
      css: { postcss: path.resolve('webmail') },
      server: { host, port: webmailPort, strictPort: true },
    })
    await webmailServer.listen()
  } catch (error) {
    await Promise.allSettled([adminServer?.close(), webmailServer?.close(), closeHttp(apiServer)])
    throw error
  }

  return async () => {
    await Promise.allSettled([adminServer?.close(), webmailServer?.close(), closeHttp(apiServer)])
  }
}
