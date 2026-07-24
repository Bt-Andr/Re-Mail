export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const TOKEN_KEY = 'rmm_token'

let unauthorizedHandler: (() => void) | null = null
export function registerUnauthorizedHandler(cb: () => void): void {
  unauthorizedHandler = cb
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// Porte le pattern de jeprogroup-website/web/services/authService.ts (fetch brut,
// bearer token en localStorage, intercepteur 401), avec une différence : ne jamais
// fixer Content-Type quand le corps est du FormData (composeur + upload de fichier
// d'invitation envoient du multipart) — laisser le navigateur poser le boundary.
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    unauthorizedHandler?.()
  }

  return res
}

// Ce backend renvoie toujours { error: string } en cas d'échec — helper pour
// les messages de toast/formulaire.
export async function parseError(res: Response, fallback = 'Une erreur est survenue.'): Promise<string> {
  try {
    const body = await res.json()
    return typeof body?.error === 'string' ? body.error : fallback
  } catch {
    return fallback
  }
}
