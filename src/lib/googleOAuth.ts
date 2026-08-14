import config from '../config'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

// Scope IMAP/SMTP XOAUTH2 — PAS gmail.readonly/gmail.send, qui sont des scopes de l'API
// REST Gmail et ne fonctionnent pas pour une authentification IMAP/SMTP classique.
const SCOPE = 'https://mail.google.com/ openid email'

function requireGoogleOAuthConfig(): { clientId: string; clientSecret: string } {
  if (!config.googleOAuthClientId || !config.googleOAuthClientSecret) {
    throw new Error('Gmail OAuth non configuré (GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET manquants).')
  }
  return { clientId: config.googleOAuthClientId, clientSecret: config.googleOAuthClientSecret }
}

// Toujours le même, fixé par l'URI de redirection enregistrée dans Google Cloud Console.
function redirectUri(): string {
  return `${config.backendUrl}/api/mailbox-connections/gmail/callback`
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId } = requireGoogleOAuthConfig()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    // access_type=offline + prompt=consent : sans ça, Google ne renvoie un refresh_token
    // qu'au tout premier consentement — jamais aux suivants.
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<{ refreshToken: string; accessToken: string }> {
  const { clientId, clientSecret } = requireGoogleOAuthConfig()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Échange du code OAuth Google échoué (${res.status})`)
  const data = (await res.json()) as { access_token?: string; refresh_token?: string }
  if (!data.refresh_token) throw new Error("Google n'a renvoyé aucun refresh_token")
  if (!data.access_token) throw new Error("Google n'a renvoyé aucun access_token")
  return { refreshToken: data.refresh_token, accessToken: data.access_token }
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = requireGoogleOAuthConfig()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Rafraîchissement du token Google échoué (${res.status})`)
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error("Google n'a renvoyé aucun access_token au rafraîchissement")
  return data.access_token
}

export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Récupération de l'adresse Google échouée (${res.status})`)
  const data = (await res.json()) as { email?: string }
  if (!data.email) throw new Error("Google n'a renvoyé aucune adresse email")
  return data.email
}
