// Doit s'exécuter AVANT tout import de src/config.ts (qui lit process.env au
// chargement du module) — vitest garantit que les setupFiles tournent en premier.
process.env.JWT_SECRET ??= 'test_jwt_secret_do_not_use_in_prod'
process.env.MASTER_ENCRYPTION_KEY ??= 'HIMbQvQG5UkO/A4HeBizW9zXwOLb9moDH27/vbDuyU4='
process.env.INVITE_FILE_ENCRYPTION_KEY ??= 'XHBB0fbNmr4laVYO3CWAy7rDE3vbDXfmcErHIEsfvGM='
process.env.MAILBOX_CREDENTIAL_ENCRYPTION_KEY ??= '4YrTDz6+oklXCckKryYhinwvyoAkCtJP0oCoD2H2IJk='
process.env.DATABASE_URL ??= 'postgresql://postgres:test@localhost:5433/resend_mail_test'
process.env.NODE_ENV = 'test'
process.env.FRONTEND_URL ??= 'http://localhost:5173'
process.env.WEBMAIL_URL ??= 'http://localhost:5174'
process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://localhost:5174'
process.env.BACKEND_URL ??= 'http://localhost:3001'
process.env.GOOGLE_OAUTH_CLIENT_ID ??= 'test-google-client-id'
process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= 'test-google-client-secret'
