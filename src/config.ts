import dotenv from 'dotenv'
dotenv.config()

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`)
  return value
}

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,

  jwtSecret: required('JWT_SECRET'),
  masterEncryptionKey: required('MASTER_ENCRYPTION_KEY'),
  // Clé dédiée aux fichiers d'invitation d'activation (voir src/lib/inviteFileCrypto.ts) —
  // volontairement distincte de MASTER_ENCRYPTION_KEY.
  inviteFileEncryptionKey: required('INVITE_FILE_ENCRYPTION_KEY'),
  // Clé dédiée aux identifiants de boîtes externes (voir src/lib/mailboxCredentialCrypto.ts) —
  // volontairement distincte de MASTER_ENCRYPTION_KEY.
  mailboxCredentialEncryptionKey: required('MAILBOX_CREDENTIAL_ENCRYPTION_KEY'),

  // Intervalle du polling des boîtes externes connectées (IMAP) — voir src/jobs/mailboxPoller.ts.
  mailboxPollIntervalMs: parseInt(process.env.MAILBOX_POLL_INTERVAL_MS || '240000', 10),

  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173'],
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Base publique de CETTE API — sert à construire l'URL de webhook unique par
  // organisation (voir routes/organizations.ts) à coller dans le dashboard Resend.
  backendUrl: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || '3001'}`,

  // Stockage des pièces jointes : un seul compte partagé pour tout le SaaS
  // (pas un secret par organisation — les fichiers sont rangés par dossier organizationId).
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
}

export default config
