import { useCallback, useEffect, useState } from 'react'
import { apiFetch, networkErrorMessage, parseError } from '../lib/apiClient'
import type { SenderAddress } from '../types/api'

export function useSenders() {
  const [senders, setSenders] = useState<SenderAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refetch = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/emails/senders')
      if (res.ok) {
        setSenders(await res.json())
      } else {
        setError(await parseError(res))
      }
    } catch (err) {
      setError(networkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { senders, loading, error, refetch }
}
