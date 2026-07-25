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
  body?: BodyInit | Record<string, unknown> | null;
}

// Miroir de web/src/lib/apiClient.ts : fetch brut, bearer token, jamais de
// Content-Type manuel pour du FormData. Seul le 401 ("Token manquant") force
// une déconnexion — un 403 peut être une simple restriction de rôle/accès sur
// une ressource et doit rester une erreur affichée en ligne, pas un logout.
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { headers, body, ...rest } = options;
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

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders, body: finalBody });

  if (res.status === 401) {
    await clearToken();
    unauthorizedHandler?.();
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function parseError(res: Response, fallback = 'Une erreur est survenue.'): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return typeof body?.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}
