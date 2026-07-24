import { useEffect, useRef } from 'react'

// Intervalle générique — utilisé par la boîte de réception pour rafraîchir la
// liste de threads toutes les 30s. Pas de Notification API (hors périmètre v1).
export function usePolling(callback: () => void, intervalMs: number, enabled = true): void {
  const savedCallback = useRef(callback)
  savedCallback.current = callback

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => savedCallback.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
}
