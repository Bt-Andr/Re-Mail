import { resolveActiveToken } from './accountsStorage'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Un seul jeton "actif" à la fois (le backend reste scopé à une organisation par
// requête) mais plusieurs comptes coexistent en storage — voir accountsStorage.ts.
// Le handler enregistré ici (par SessionContext) décide QUEL compte retirer sur un 401.
let unauthorizedHandler: (() => void) | null = null
export function registerUnauthorizedHandler(cb: () => void): void {
  unauthorizedHandler = cb
}

interface ApiFetchOptions extends RequestInit {
  // Pour les endpoints publics dont un 401 est un échec métier (ex. jeton d'échange
  // expiré/déjà consommé sur /auth/google/exchange), pas une session rejetée — un token
  // ambiant peut être présent en storage sans rapport avec cet appel précis. Sans ce
  // flag, ce 401 effacerait à tort une session valide déjà en place.
  skipAuthRedirect?: boolean
}

// Porte le pattern de jeprogroup-website/web/services/authService.ts (fetch brut,
// bearer token en localStorage, intercepteur 401), avec une différence : ne jamais
// fixer Content-Type quand le corps est du FormData (composeur + upload de fichier
// d'invitation envoient du multipart) — laisser le navigateur poser le boundary.
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { skipAuthRedirect, ...rest } = options
  const token = resolveActiveToken()
  const isFormData = rest.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((rest.headers as Record<string, string>) || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const method = rest.method || 'GET'
  const res = await fetch(`${API_URL}${path}`, { ...rest, headers })

  // Un 401 sans token (login/signup/activation — endpoints publics, jamais de
  // session en cours) est un échec d'identifiants normal, pas une session
  // invalidée : forcer clearToken+redirect ici renavigait vers /login au
  // mauvais moment et effaçait le message d'erreur avant qu'il s'affiche (le
  // bug "toujours renvoyé sur la connexion, sans erreur visible"). Seul un 401
  // avec un token déjà présent signifie une vraie session à invalider (ex.
  // GET /auth/me quand l'utilisateur a été supprimé côté serveur) — sauf pour
  // les endpoints marqués skipAuthRedirect, dont le 401 n'a jamais rapport à un
  // token ambiant (voir mobile/src/api/client.ts pour le même correctif, motivé
  // par une vraie régression : double interception du retour Google effaçant une
  // session tout juste établie).
  if (res.status === 401) {
    if (token && !skipAuthRedirect) {
      console.error(`[api] 401 — ${method} ${path} → déconnexion forcée du compte actif (jeton présent mais rejeté)`)
      // Le retrait du compte en storage est délégué au handler (SessionContext) : lui
      // seul sait quel compte était actif et vers lequel basculer ensuite.
      unauthorizedHandler?.()
    } else {
      console.error(`[api] 401 — ${method} ${path} (${skipAuthRedirect ? 'endpoint public, pas une session à invalider' : 'pas de session en cours'})`)
    }
  } else if (!res.ok) {
    console.error(`[api] échec ${res.status} — ${method} ${path}`)
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

// apiFetch() ne throw jamais pour une réponse HTTP d'erreur (gérée via res.ok +
// parseError) — un `catch` autour d'un appel apiFetch() n'attrape donc QUE un
// échec réseau réel (offline, backend injoignable, DNS...). Sans ça, plusieurs
// écrans restaient bloqués en silence (spinner infini ou formulaire vide) sur
// une simple coupure réseau.
export function networkErrorMessage(e: unknown): string {
  console.error('[api] échec réseau', e)
  return 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.'
}
