import { API_URL } from '../lib/config';
import { getToken, clearToken } from '../lib/session';
import type { ApiErrorBody } from '../types/api';

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(cb: UnauthorizedHandler): void {
  unauthorizedHandler = cb;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | object | null;
  // Pour les endpoints publics dont un 401 est un échec métier (ex. jeton d'échange
  // expiré/déjà consommé sur /auth/google/exchange), pas une session rejetée — un token
  // ambiant peut être présent en storage sans rapport avec cet appel précis (ex. deux
  // interceptions concurrentes du même retour OAuth sur Android, voir google-callback.tsx :
  // le perdant de la course reçoit un 401 sur un jeton déjà consommé, et sans ce flag
  // effacerait la session que le gagnant vient tout juste d'établir).
  skipAuthRedirect?: boolean;
}

// Miroir de web/src/lib/apiClient.ts : fetch brut, bearer token, jamais de
// Content-Type manuel pour du FormData. Seul le 401 ("Token manquant") force
// une déconnexion — un 403 peut être une simple restriction de rôle/accès sur
// une ressource et doit rester une erreur affichée en ligne, pas un logout.
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { headers, body, skipAuthRedirect, ...rest } = options;
  const token = await getToken();
  const isFormData = body instanceof FormData;

  const finalHeaders = new Headers(headers);
  if (!isFormData && body !== undefined && body !== null) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (token) finalHeaders.set('Authorization', `Bearer ${token}`);

  const finalBody: BodyInit | undefined = isFormData
    ? (body as FormData)
    : body !== undefined && body !== null
      ? JSON.stringify(body)
      : undefined;

  const method = rest.method ?? 'GET';
  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders, body: finalBody });

  // Un 401 sans token (login/signup/activation — endpoints publics, jamais de
  // session en cours) est un échec d'identifiants normal, pas une session
  // invalidée : forcer clearToken+redirect ici remontait /login au mauvais
  // moment et effaçait le message d'erreur avant qu'il s'affiche (le bug
  // "toujours renvoyé sur la connexion, sans erreur visible"). Seul un 401
  // avec un token déjà présent signifie une vraie session à invalider (ex.
  // GET /auth/me quand l'utilisateur a été supprimé côté serveur).
  if (res.status === 401) {
    if (token && !skipAuthRedirect) {
      console.error(`[api] 401 — ${method} ${path} → déconnexion forcée (token présent mais rejeté)`);
      await clearToken();
      unauthorizedHandler?.();
    } else {
      console.error(`[api] 401 — ${method} ${path} (${skipAuthRedirect ? 'endpoint public, pas une session à invalider' : 'pas de session en cours'})`);
    }
  }

  if (!res.ok) {
    const message = await parseError(res);
    if (res.status !== 401) console.error(`[api] échec ${res.status} — ${method} ${path}`, message);
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// À utiliser dans les écrans d'auth (login/activation) : un échec qui n'est PAS
// une ApiError vient du fetch lui-même (backend injoignable, mauvaise IP,
// téléphone hors du réseau local…) — l'afficher tel quel plutôt que de laisser
// un message générique ("identifiants incorrects", "code invalide"…) mentir sur
// la cause réelle.
export function describeError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  console.error('[api] échec réseau', e);
  return `Connexion au serveur impossible (${API_URL}). Vérifiez que le backend tourne et que cette adresse est bien accessible depuis cet appareil.`;
}

async function parseError(res: Response, fallback = 'Une erreur est survenue.'): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return typeof body?.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}
