export interface PushPayload {
  title: string
  body: string
  data?: Record<string, unknown>
}

export interface PushTarget {
  token: string
}

// Wrapper autour de l'API Expo Push — choix cohérent avec la stack mobile
// (React Native/Expo) : une seule API HTTP pour iOS+Android, sans certificats
// FCM/APNs séparés à gérer. Conçu comme un point d'entrée unique et swappable :
// si un autre provider de push est nécessaire un jour, seul ce fichier change.
export async function sendPush(targets: PushTarget[], payload: PushPayload): Promise<void> {
  if (!targets.length) return

  const messages = targets.map(t => ({
    to: t.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }))

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    })
    if (!res.ok) {
      console.warn(`[PUSH] Réponse Expo non-OK (${res.status})`)
    }
  } catch (e) {
    console.error('[PUSH] Échec envoi:', (e as Error).message)
  }
}
