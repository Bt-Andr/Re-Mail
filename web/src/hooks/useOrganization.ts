import { useCallback, useEffect, useState } from 'react'
import { apiFetch, networkErrorMessage, parseError } from '../lib/apiClient'
import type { OrganizationStatus } from '../types/api'

export function useOrganization() {
  const [organization, setOrganization] = useState<OrganizationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refetch = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/organizations/me')
      if (res.ok) {
        setOrganization(await res.json())
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

  return { organization, loading, error, refetch }
}
