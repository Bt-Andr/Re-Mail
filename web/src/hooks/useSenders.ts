import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiClient'
import type { SenderAddress } from '../types/api'

export function useSenders() {
  const [senders, setSenders] = useState<SenderAddress[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/emails/senders')
      if (res.ok) setSenders(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { senders, loading, refetch }
}
